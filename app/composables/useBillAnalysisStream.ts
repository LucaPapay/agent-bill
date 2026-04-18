import { consumeEventIterator } from '@orpc/client'

let currentCancel: null | (() => Promise<void>) = null

function isPendingResult(value: any) {
  const source = String(value?.source || '').trim()
  return source === 'pi-agent-pending' || source === 'receipt-pending'
}

function trimFeed(feed: Array<{ text: string; who: string }>, entry: { text: string; who: string }) {
  return [...feed, entry].slice(-120)
}

function resolveReceipt(value: any) {
  if (value?.receipt) {
    return value.receipt
  }

  if (!value) {
    return null
  }

  return {
    billDate: String(value.billDate || ''),
    currency: String(value.currency || 'EUR'),
    items: Array.isArray(value.items) ? value.items : [],
    merchant: String(value.merchant || ''),
    notes: Array.isArray(value.notes) ? value.notes : [],
    taxCents: Number(value.taxCents || 0),
    tipCents: Number(value.tipCents || 0),
    totalCents: Number(value.totalCents || 0),
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

export function useBillAnalysisStream() {
  const assistantText = useState('bill-analysis:assistant-text', () => '')
  const chatId = useState('bill-analysis:chat-id', () => '')
  const error = useState('bill-analysis:error', () => '')
  const feed = useState<Array<{ text: string; who: string }>>('bill-analysis:feed', () => [])
  const jobId = useState('bill-analysis:job-id', () => '')
  const loadingChat = useState('bill-analysis:loading-chat', () => false)
  const receipt = useState<any>('bill-analysis:receipt', () => null)
  const recentChats = useState<any[]>('bill-analysis:recent-chats', () => [])
  const result = useState<any>('bill-analysis:result', () => null)
  const status = useState('bill-analysis:status', () => 'idle')

  function stop() {
    if (currentCancel) {
      void currentCancel()
      currentCancel = null
    }
  }

  function clearCurrent() {
    assistantText.value = ''
    chatId.value = ''
    error.value = ''
    feed.value = []
    jobId.value = ''
    receipt.value = null
    result.value = null
    status.value = 'idle'
  }

  function reset() {
    stop()
    clearCurrent()
  }

  function pushFeed(who: string, text: string) {
    feed.value = trimFeed(feed.value, { text, who })
  }

  function applyResult(nextResult: any) {
    assistantText.value = ''
    chatId.value = nextResult?.chatId || ''
    error.value = ''
    feed.value = Array.isArray(nextResult?.history) ? nextResult.history : []
    jobId.value = nextResult?.runId || ''
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

    if (payload.type === 'agent_progress') {
      return
    }

    if (payload.type === 'agent_text_delta') {
      assistantText.value += payload.delta
      return
    }

    if (payload.type === 'agent_tool_start') {
      pushFeed('log', `Tool: ${payload.toolName}`)
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

        if (isPendingResult(value)) {
          openStream(useOrpc().attachBillChatStream({
            chatId: normalizedChatId,
          }))
        }

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

  async function start(input: any) {
    reset()
    status.value = 'starting'
    pushFeed('log', 'Penny is opening the analysis stream and buckling in.')

    openStream(useOrpc().analyzeBillStream(input))

    return null
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
      groupId: String(groupId || '').trim() || undefined,
      imageBase64: await fileToBase64(file),
      mimeType: file.type || 'image/jpeg',
      people,
      title,
    })
  }

  function openRevisionStream(
    message: string,
    people: string[] = [],
    options: {
      displayUserMessage?: string
      groupId?: string
      pushUserMessage?: boolean
      systemMessage?: string
    } = {},
  ) {
    stop()
    assistantText.value = ''
    error.value = ''
    status.value = 'starting'

    if (options.pushUserMessage !== false) {
      pushFeed('user', options.displayUserMessage || message)
    }

    openStream(useOrpc().reviseBillSplitStream({
      chatId: chatId.value,
      groupId: String(options.groupId || '').trim() || undefined,
      message,
      people,
      systemMessage: String(options.systemMessage || '').trim() || undefined,
      userMessage: options.pushUserMessage === false
        ? undefined
        : String(options.displayUserMessage || message).trim() || undefined,
    }))
  }

  async function revise(message: string, people: string[] = [], groupId = '') {
    const nextMessage = String(message || '').trim()

    if (!nextMessage || !chatId.value || !resolveReceipt(result.value || receipt.value)) {
      return null
    }

    openRevisionStream(nextMessage, people, {
      groupId,
    })

    return null
  }

  async function requestSplitQuestion(people: string[] = [], groupId = '') {
    if (!chatId.value || !resolveReceipt(result.value || receipt.value)) {
      return null
    }

    openRevisionStream(
      'Ask me one short question that will give you enough information to create the split for this receipt. Do not create the split yet.',
      people,
      {
        groupId,
        pushUserMessage: false,
      },
    )

    return null
  }

  async function requestGroupQuestion() {
    if (!chatId.value || !resolveReceipt(result.value || receipt.value)) {
      return null
    }

    openRevisionStream(
      'Ask me which group this receipt belongs to before you create any split. Do not guess the group and do not create the split yet.',
      [],
      {
        pushUserMessage: false,
      },
    )

    return null
  }

  async function confirmGroupSelection(groupName: string, people: string[] = [], displayUserMessage = '', groupId = '') {
    const normalizedGroupName = String(groupName || '').trim()
    const participantSummary = people.length
      ? `The participants are ${people.join(', ')}.`
      : 'Use the participants from that group.'

    if (!normalizedGroupName || !chatId.value || !resolveReceipt(result.value || receipt.value)) {
      return null
    }

    openRevisionStream(
      `The selected group is "${normalizedGroupName}". ${participantSummary} Do not ask me to select the group again. Build the first split now using the parsed receipt and any relevant previous split hints. Only ask me one short follow-up question if the receipt is still too ambiguous after considering those hints.`,
      people,
      {
        displayUserMessage: String(displayUserMessage || normalizedGroupName).trim() || normalizedGroupName,
        groupId,
        systemMessage: `Selected group: ${normalizedGroupName}`,
      },
    )

    return null
  }

  return {
    assistantText,
    chatId,
    error,
    feed,
    jobId,
    loadChat,
    loadChats,
    loadingChat,
    receipt,
    recentChats,
    reset,
    result,
    confirmGroupSelection,
    revise,
    requestGroupQuestion,
    requestSplitQuestion,
    start,
    startFromFile,
    status,
    stop,
  }
}
