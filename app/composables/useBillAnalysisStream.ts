import { consumeEventIterator } from '@orpc/client'

let currentCancel: null | (() => Promise<void>) = null

function isPendingResult(value: any) {
  return String(value?.context?.status || '').trim() === 'running'
    || String(value?.source || '').trim() === 'penny-pending'
}

function normalizeFeedEntry(entry: any) {
  const text = String(entry?.text || '').trim()
  const toolName = String(entry?.toolName || '').trim()
    || (/^Tool:\s*/.test(text) ? text.replace(/^Tool:\s*/, '').trim() : '')

  return {
    kind: toolName ? 'tool' : 'message',
    text,
    toolName,
    toolState: toolName ? String(entry?.toolState || 'done') : '',
    who: String(entry?.who || 'log'),
  }
}

function trimFeed(feed: any[], entry: any) {
  return [...feed, normalizeFeedEntry(entry)].slice(-120)
}

function resolveReceipt(value: any) {
  if (value?.context?.receipt) {
    return value.context.receipt
  }

  if (value?.receipt) {
    return value.receipt
  }

  if (!value) {
    return null
  }

  return {
    billDate: String(value.context?.billDate || value.billDate || ''),
    currency: String(value.context?.currency || value.currency || 'EUR'),
    items: Array.isArray(value.context?.items) ? value.context.items : Array.isArray(value.items) ? value.items : [],
    merchant: String(value.context?.merchant || value.merchant || ''),
    notes: Array.isArray(value.context?.notes) ? value.context.notes : Array.isArray(value.notes) ? value.notes : [],
    taxCents: Number(value.context?.taxCents || value.taxCents || 0),
    tipCents: Number(value.context?.tipCents || value.tipCents || 0),
    totalCents: Number(value.context?.totalCents || value.totalCents || 0),
  }
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.split(',')[1] || '' : value)
    }

    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

function buildSavedFeed(nextResult: any) {
  if (Array.isArray(nextResult?.history) && nextResult.history.length) {
    return nextResult.history.map((entry: any) => normalizeFeedEntry(entry))
  }

  if (!Array.isArray(nextResult?.messages)) {
    return []
  }

  return nextResult.messages.map((entry: any) => normalizeFeedEntry({
    text: entry.text,
    who: entry.role === 'assistant' ? 'penny' : 'user',
  }))
}

export function useBillAnalysisStream() {
  const chatId = useState('bill-analysis:chat-id', () => '')
  const error = useState('bill-analysis:error', () => '')
  const feed = useState<any[]>('bill-analysis:feed', () => [])
  const loadingChat = useState('bill-analysis:loading-chat', () => false)
  const receipt = useState<any>('bill-analysis:receipt', () => null)
  const recentChats = useState<any[]>('bill-analysis:recent-chats', () => [])
  const result = useState<any>('bill-analysis:result', () => null)
  const status = useState('bill-analysis:status', () => 'idle')
  const parsedReceipt = computed(() => resolveReceipt(result.value || receipt.value))
  const splitRows = computed(() =>
    Array.isArray(result.value?.context?.split) ? result.value.context.split : Array.isArray(result.value?.split) ? result.value.split : [],
  )
  const groupId = computed(() => String(result.value?.context?.groupId || result.value?.groupId || '').trim())
  const source = computed(() => String(result.value?.context?.source || result.value?.source || '').trim())

  function stop() {
    if (currentCancel) {
      void currentCancel()
      currentCancel = null
    }
  }

  function clearCurrent() {
    chatId.value = ''
    error.value = ''
    feed.value = []
    receipt.value = null
    result.value = null
    status.value = 'idle'
  }

  function reset() {
    stop()
    clearCurrent()
  }

  function pushFeed(entryOrWho: any, text = '') {
    const entry = typeof entryOrWho === 'string'
      ? { text, who: entryOrWho }
      : entryOrWho

    feed.value = trimFeed(feed.value, entry)
  }

  function markToolFeed(toolName: string, isError: boolean) {
    for (let index = feed.value.length - 1; index >= 0; index -= 1) {
      const entry = feed.value[index]

      if (entry?.kind !== 'tool' || entry.toolName !== toolName || entry.toolState !== 'running') {
        continue
      }

      feed.value = [
        ...feed.value.slice(0, index),
        {
          ...entry,
          toolState: isError ? 'error' : 'done',
        },
        ...feed.value.slice(index + 1),
      ]
      return
    }
  }

  function applyResult(nextResult: any) {
    chatId.value = nextResult?.chatId || ''
    error.value = ''
    feed.value = buildSavedFeed(nextResult)
    receipt.value = resolveReceipt(nextResult)
    result.value = nextResult
    status.value = isPendingResult(nextResult) ? 'agent' : 'complete'
  }

  function openStream(stream: any) {
    stop()

    currentCancel = consumeEventIterator(stream, {
      onEvent: (event) => {
        applyPayload(event)
      },
      onError: (streamError: any) => {
        if (status.value === 'complete' || status.value === 'error') {
          return
        }

        error.value = streamError?.message || 'The live analysis stream disconnected.'
        status.value = 'error'
        pushFeed('log', error.value)
      },
      onFinish: () => {
        currentCancel = null
      },
    })
  }

  function applyPayload(payload: any) {
    if (payload.type === 'chat_started') {
      chatId.value = payload.chatId
      return
    }

    if (payload.type === 'status') {
      status.value = payload.phase
      return
    }

    if (payload.type === 'receipt_extracted') {
      receipt.value = payload.receipt
      return
    }

    if (payload.type === 'agent_text_delta') {
      return
    }

    if (payload.type === 'agent_tool_start') {
      pushFeed({
        text: `Tool: ${payload.toolName}`,
        toolName: payload.toolName,
        toolState: 'running',
        who: 'log',
      })
      return
    }

    if (payload.type === 'agent_tool_end') {
      markToolFeed(payload.toolName, payload.isError)
      return
    }

    if (payload.type === 'complete') {
      applyResult(payload.result)
      stop()
      void loadChats()
      return
    }

    if (payload.type === 'error') {
      error.value = payload.message
      status.value = 'error'
      pushFeed('log', payload.message)
      stop()
    }
  }

  function buildChatContext(groupId = '', people: string[] = [], title = '') {
    return {
      groupId: String(groupId || '').trim() || undefined,
      people,
      title: String(title || '').trim() || undefined,
    }
  }

  async function loadChats() {
    recentChats.value = await useOrpc().listBillChats()
    return recentChats.value
  }

  async function loadChat(nextChatId: string) {
    const normalizedChatId = String(nextChatId || '').trim()

    if (!normalizedChatId) {
      reset()
      return null
    }

    if (chatId.value === normalizedChatId && result.value?.chatId === normalizedChatId) {
      return result.value
    }

    stop()
    loadingChat.value = true
    error.value = ''
    status.value = 'starting'

    return await useOrpc().getBillChat({ chatId: normalizedChatId }).then(
      (value: any) => {
        applyResult(value)
        return value
      },
      (loadError: any) => {
        clearCurrent()
        error.value = loadError?.message || 'Could not load that saved split chat.'
        status.value = 'error'
        return null
      },
    ).finally(() => {
      loadingChat.value = false
    })
  }

  async function sendMessages(messages: any[], context: any = {}, options: { resetChat?: boolean } = {}) {
    if (!Array.isArray(messages) || !messages.length) {
      return null
    }

    if (options.resetChat) {
      reset()
    }
    else {
      stop()
      error.value = ''
    }

    status.value = 'starting'
    openStream(useOrpc().chatStream({
      chatId: options.resetChat ? undefined : chatId.value || undefined,
      context,
      messages,
    }))

    return null
  }

  async function start(input: any) {
    const data = {
      groupId: String(input?.groupId || '').trim() || undefined,
      imageBase64: String(input?.imageBase64 || '').trim() || undefined,
      mimeType: String(input?.mimeType || '').trim() || undefined,
      people: Array.isArray(input?.people) ? input.people : [],
      rawText: String(input?.rawText || '').trim() || undefined,
      title: String(input?.title || '').trim() || undefined,
    }

    return await sendMessages([{
      data,
      role: 'user',
      text: String(input?.text || '').trim(),
    }], buildChatContext(data.groupId, data.people, data.title), {
      resetChat: true,
    })
  }

  async function startFromFile({
    file,
    groupId = '',
    title,
    people = [],
  }: {
    file: File
    groupId?: string
    title: string
    people?: string[]
  }) {
    return await start({
      groupId,
      imageBase64: await fileToBase64(file),
      mimeType: file.type || 'image/jpeg',
      people,
      title,
    })
  }

  async function revise(message: string, people: string[] = [], groupId = '') {
    const nextMessage = String(message || '').trim()

    if (!nextMessage || !chatId.value || !resolveReceipt(result.value || receipt.value)) {
      return null
    }

    pushFeed('user', nextMessage)

    await sendMessages([{
      data: {
        groupId: String(groupId || '').trim() || undefined,
        people,
      },
      role: 'user',
      text: nextMessage,
    }], buildChatContext(groupId, people))

    return null
  }

  async function confirmGroupSelection(groupName: string, people: string[] = [], displayUserMessage = '', groupId = '') {
    const normalizedGroupName = String(groupName || '').trim()

    if (!normalizedGroupName || !chatId.value || !resolveReceipt(result.value || receipt.value)) {
      return null
    }

    const nextMessage = String(displayUserMessage || normalizedGroupName).trim() || normalizedGroupName

    pushFeed('user', nextMessage)

    await sendMessages([{
      data: {
        groupId: String(groupId || '').trim() || undefined,
        people,
      },
      role: 'user',
      text: nextMessage,
    }], buildChatContext(groupId, people))

    return null
  }

  return {
    chatId,
    error,
    feed,
    groupId,
    loadChat,
    loadChats,
    loadingChat,
    parsedReceipt,
    receipt,
    recentChats,
    reset,
    result,
    confirmGroupSelection,
    revise,
    source,
    splitRows,
    start,
    startFromFile,
    status,
    stop,
  }
}
