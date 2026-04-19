import { consumeEventIterator } from '@orpc/client'

let currentCancel: null | (() => Promise<void>) = null

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

function buildMessageEntry(message: any) {
  const text = String(message?.text || '').trim()

  if (!text) {
    return null
  }

  return {
    kind: 'message',
    text,
    who: message?.role === 'assistant' ? 'penny' : 'user',
  }
}

function buildFeed(result: any) {
  if (!Array.isArray(result?.messages)) {
    return []
  }

  return result.messages
    .map(buildMessageEntry)
    .filter(Boolean)
    .slice(-120)
}

function isPendingResult(result: any) {
  return String(result?.status || '').trim() === 'running'
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
  const parsedReceipt = computed(() => result.value?.receipt || receipt.value)
  const splitRows = computed(() => Array.isArray(result.value?.split) ? result.value.split : [])
  const groupId = computed(() => String(result.value?.groupId || '').trim())

  function stop() {
    if (!currentCancel) {
      return
    }

    void currentCancel()
    currentCancel = null
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

  function pushFeed(entry: any) {
    feed.value = [...feed.value, entry].slice(-120)
  }

  function pushUserMessage(text: string) {
    const normalizedText = String(text || '').trim()

    if (!normalizedText) {
      return
    }

    pushFeed({
      kind: 'message',
      text: normalizedText,
      who: 'user',
    })
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
    error.value = nextResult?.status === 'error'
      ? String(nextResult?.summary || '').trim()
      : ''
    feed.value = buildFeed(nextResult)
    receipt.value = nextResult?.receipt || null
    result.value = nextResult
    status.value = nextResult?.status === 'error'
      ? 'error'
      : isPendingResult(nextResult)
        ? 'agent'
        : 'complete'
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

    if (payload.type === 'agent_tool_start') {
      pushFeed({
        kind: 'tool',
        toolName: payload.toolName,
        toolState: 'running',
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
      pushFeed({
        kind: 'message',
        text: payload.message,
        who: 'system',
      })
      stop()
    }
  }

  function openStream(stream: any) {
    stop()

    currentCancel = consumeEventIterator(stream, {
      onEvent: applyPayload,
      onError: (streamError: any) => {
        if (status.value === 'complete' || status.value === 'error') {
          return
        }

        error.value = streamError?.message || 'The live analysis stream disconnected.'
        status.value = 'error'
        pushFeed({
          kind: 'message',
          text: error.value,
          who: 'system',
        })
      },
      onFinish: () => {
        currentCancel = null
      },
    })
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

  async function sendMessages(nextMessages: any[], options: { resetChat?: boolean } = {}) {
    if (!Array.isArray(nextMessages) || !nextMessages.length) {
      return null
    }

    if (options.resetChat) {
      reset()
    } else {
      stop()
      error.value = ''
    }

    status.value = 'starting'
    openStream(useOrpc().chatStream({
      chatId: options.resetChat ? undefined : chatId.value || undefined,
      messages: nextMessages,
    }))

    return null
  }

  async function start(input: any) {
    const message = {
      data: {
        groupId: String(input?.groupId || '').trim() || undefined,
        imageBase64: String(input?.imageBase64 || '').trim() || undefined,
        mimeType: String(input?.mimeType || '').trim() || undefined,
        people: Array.isArray(input?.people) ? input.people : [],
        rawText: String(input?.rawText || '').trim() || undefined,
        title: String(input?.title || '').trim() || undefined,
      },
      role: 'user',
      text: String(input?.text || '').trim(),
    }

    return await sendMessages([message], {
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

    if (!nextMessage || !chatId.value || !parsedReceipt.value) {
      return null
    }

    pushUserMessage(nextMessage)

    await sendMessages([{
      data: {
        groupId: String(groupId || '').trim() || undefined,
        people,
      },
      role: 'user',
      text: nextMessage,
    }])

    return null
  }

  async function confirmGroupSelection(groupName: string, people: string[] = [], displayUserMessage = '', groupId = '') {
    const normalizedGroupName = String(groupName || '').trim()

    if (!normalizedGroupName || !chatId.value || !parsedReceipt.value) {
      return null
    }

    const nextMessage = String(displayUserMessage || normalizedGroupName).trim() || normalizedGroupName
    pushUserMessage(nextMessage)

    await sendMessages([{
      data: {
        groupId: String(groupId || '').trim() || undefined,
        people,
      },
      role: 'user',
      text: nextMessage,
    }])

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
    splitRows,
    start,
    startFromFile,
    status,
    stop,
  }
}
