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

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function normalizeMessageData(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeRole(value: unknown) {
  const role = normalizeText(value)

  if (role === 'user' || role === 'assistant' || role === 'system') {
    return role
  }

  return 'assistant'
}

function normalizeKind(value: unknown) {
  const kind = normalizeText(value)

  if (
    kind === 'group_select'
    || kind === 'loading'
    || kind === 'preview'
    || kind === 'receipt'
    || kind === 'text'
    || kind === 'tool'
  ) {
    return kind
  }

  return 'text'
}

function normalizeStoredMessage(message: any, index: number) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return null
  }

  const role = normalizeRole(message.role)
  const kind = normalizeKind(message.kind)
  const text = normalizeText(message.text)
  const data = normalizeMessageData(message.data)

  if (!text && !Object.keys(data).length) {
    return null
  }

  return {
    data,
    id: normalizeText(message.id) || `saved-${index}`,
    kind,
    role,
    text,
  }
}

function normalizeStoredMessages(result: any) {
  const messages = Array.isArray(result?.messages)
    ? result.messages
      .map(normalizeStoredMessage)
      .filter(Boolean)
      .slice(-120)
    : []

  const summary = normalizeText(result?.summary)
  const hasErrorMessage = messages.some((entry: any) =>
    entry?.kind === 'text'
    && entry?.role === 'system'
    && entry?.text === summary,
  )

  if (normalizeText(result?.status) === 'error' && summary && !hasErrorMessage) {
    return [...messages, {
      data: {},
      id: 'error-summary',
      kind: 'text',
      role: 'system',
      text: summary,
    }].slice(-120)
  }

  return messages
}

function buildReceiptMessage({
  receipt,
  splitRows,
  summary,
}: {
  receipt?: any
  splitRows?: any[]
  summary?: string
}) {
  if (!receipt || typeof receipt !== 'object') {
    return null
  }

  return {
    data: {
      receipt,
      splitRows: Array.isArray(splitRows) ? splitRows : [],
      summary: normalizeText(summary),
    },
    id: 'receipt',
    kind: 'receipt',
    role: 'assistant',
    text: normalizeText(summary),
  }
}

function buildLoadingMessage(status: string, loadingChat: boolean) {
  if (!loadingChat && !['agent', 'extracting', 'queued', 'starting'].includes(status)) {
    return null
  }

  return {
    data: {
      loadingChat,
      status,
    },
    id: 'loading',
    kind: 'loading',
    role: 'assistant',
    text: '',
  }
}

function isPendingResult(result: any) {
  return normalizeText(result?.status) === 'running'
}

export function useBillAnalysisStream() {
  const baseMessages = useState<any[]>('bill-analysis:base-messages', () => [])
  const chatId = useState('bill-analysis:chat-id', () => '')
  const error = useState('bill-analysis:error', () => '')
  const groupSelectMessage = useState<any>('bill-analysis:group-select-message', () => null)
  const loadingChat = useState('bill-analysis:loading-chat', () => false)
  const loadingMessage = useState<any>('bill-analysis:loading-message', () => null)
  const previewMessage = useState<any>('bill-analysis:preview-message', () => null)
  const recentChats = useState<any[]>('bill-analysis:recent-chats', () => [])
  const receipt = useState<any>('bill-analysis:receipt', () => null)
  const receiptMessage = useState<any>('bill-analysis:receipt-message', () => null)
  const result = useState<any>('bill-analysis:result', () => null)
  const status = useState('bill-analysis:status', () => 'idle')
  const parsedReceipt = computed(() => result.value?.receipt || receipt.value)
  const splitRows = computed(() => Array.isArray(result.value?.split) ? result.value.split : [])
  const groupId = computed(() => normalizeText(result.value?.groupId))
  const messages = computed(() => {
    const nextMessages = [...baseMessages.value]

    if (previewMessage.value) {
      nextMessages.push(previewMessage.value)
    }

    if (receiptMessage.value) {
      nextMessages.push(receiptMessage.value)
    }

    if (groupSelectMessage.value) {
      nextMessages.push(groupSelectMessage.value)
    }

    if (loadingMessage.value) {
      nextMessages.push(loadingMessage.value)
    }

    return nextMessages.slice(-120)
  })

  function syncReceiptMessage() {
    receiptMessage.value = buildReceiptMessage({
      receipt: parsedReceipt.value,
      splitRows: splitRows.value,
      summary: result.value?.summary,
    })
  }

  function syncLoadingMessage() {
    loadingMessage.value = buildLoadingMessage(status.value, loadingChat.value)
  }

  function stop() {
    if (!currentCancel) {
      return
    }

    void currentCancel()
    currentCancel = null
  }

  function clearCurrent() {
    baseMessages.value = []
    chatId.value = ''
    error.value = ''
    groupSelectMessage.value = null
    loadingMessage.value = null
    previewMessage.value = null
    receipt.value = null
    receiptMessage.value = null
    result.value = null
    status.value = 'idle'
  }

  function reset() {
    stop()
    clearCurrent()
  }

  function pushBaseMessage(entry: any) {
    baseMessages.value = [...baseMessages.value, entry].slice(-120)
  }

  function appendLocalMessage(role: string, text: string) {
    const normalizedText = normalizeText(text)

    if (!normalizedText) {
      return
    }

    pushBaseMessage({
      data: {},
      id: createMessageId('local'),
      kind: 'text',
      role: normalizeRole(role),
      text: normalizedText,
    })
  }

  function setPreviewMessage(entry: any) {
    previewMessage.value = entry
      ? {
        data: normalizeMessageData(entry.data),
        id: normalizeText(entry.id) || 'preview',
        kind: 'preview',
        role: normalizeRole(entry.role || 'user'),
        text: normalizeText(entry.text),
      }
      : null
  }

  function setGroupSelectMessage(entry: any) {
    groupSelectMessage.value = entry
      ? {
        data: normalizeMessageData(entry.data),
        id: normalizeText(entry.id) || 'group-select',
        kind: 'group_select',
        role: normalizeRole(entry.role || 'assistant'),
        text: normalizeText(entry.text),
      }
      : null
  }

  function markToolMessage(toolName: string, isError: boolean) {
    for (let index = baseMessages.value.length - 1; index >= 0; index -= 1) {
      const entry = baseMessages.value[index]
      const data = normalizeMessageData(entry?.data)

      if (entry?.kind !== 'tool' || data.toolName !== toolName || data.state !== 'running') {
        continue
      }

      baseMessages.value = [
        ...baseMessages.value.slice(0, index),
        {
          ...entry,
          data: {
            ...data,
            state: isError ? 'error' : 'done',
          },
        },
        ...baseMessages.value.slice(index + 1),
      ]
      return
    }
  }

  function applyResult(nextResult: any) {
    chatId.value = nextResult?.chatId || ''
    error.value = nextResult?.status === 'error'
      ? normalizeText(nextResult?.summary)
      : ''
    baseMessages.value = normalizeStoredMessages(nextResult)
    receipt.value = nextResult?.receipt || null
    result.value = nextResult
    status.value = nextResult?.status === 'error'
      ? 'error'
      : isPendingResult(nextResult)
        ? 'agent'
        : 'complete'
    syncReceiptMessage()
    syncLoadingMessage()
  }

  function applyPayload(payload: any) {
    if (payload.type === 'chat_started') {
      chatId.value = payload.chatId
      return
    }

    if (payload.type === 'status') {
      status.value = payload.phase
      syncLoadingMessage()
      return
    }

    if (payload.type === 'receipt_extracted') {
      receipt.value = payload.receipt
      syncReceiptMessage()
      return
    }

    if (payload.type === 'agent_tool_start') {
      pushBaseMessage({
        data: {
          state: 'running',
          toolName: payload.toolName,
        },
        id: createMessageId(`tool-${payload.toolName}`),
        kind: 'tool',
        role: 'assistant',
        text: '',
      })
      return
    }

    if (payload.type === 'agent_tool_end') {
      markToolMessage(payload.toolName, payload.isError)
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
      syncLoadingMessage()
      pushBaseMessage({
        data: {},
        id: createMessageId('error'),
        kind: 'text',
        role: 'system',
        text: payload.message,
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
        syncLoadingMessage()
        pushBaseMessage({
          data: {},
          id: createMessageId('disconnect'),
          kind: 'text',
          role: 'system',
          text: error.value,
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
    const normalizedChatId = normalizeText(nextChatId)

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
    syncLoadingMessage()

    return await useOrpc().getBillChat({ chatId: normalizedChatId }).then(
      (value: any) => {
        applyResult(value)
        return value
      },
      (loadError: any) => {
        clearCurrent()
        error.value = loadError?.message || 'Could not load that saved split chat.'
        status.value = 'error'
        syncLoadingMessage()
        return null
      },
    ).finally(() => {
      loadingChat.value = false
      syncLoadingMessage()
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
    syncLoadingMessage()
    openStream(useOrpc().chatStream({
      chatId: options.resetChat ? undefined : chatId.value || undefined,
      messages: nextMessages,
    }))

    return null
  }

  async function start(input: any) {
    const message = {
      data: {
        groupId: normalizeText(input?.groupId) || undefined,
        imageBase64: normalizeText(input?.imageBase64) || undefined,
        mimeType: normalizeText(input?.mimeType) || undefined,
        people: Array.isArray(input?.people) ? input.people : [],
        rawText: normalizeText(input?.rawText) || undefined,
        title: normalizeText(input?.title) || undefined,
      },
      role: 'user',
      text: normalizeText(input?.text),
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
    const nextMessage = normalizeText(message)

    if (!nextMessage || !chatId.value || !parsedReceipt.value) {
      return null
    }

    appendLocalMessage('user', nextMessage)

    await sendMessages([{
      data: {
        groupId: normalizeText(groupId) || undefined,
        people,
      },
      role: 'user',
      text: nextMessage,
    }])

    return null
  }

  async function confirmGroupSelection(groupName: string, people: string[] = [], displayUserMessage = '', groupId = '') {
    const normalizedGroupName = normalizeText(groupName)

    if (!normalizedGroupName || !chatId.value || !parsedReceipt.value) {
      return null
    }

    const nextMessage = normalizeText(displayUserMessage || normalizedGroupName) || normalizedGroupName
    appendLocalMessage('user', nextMessage)

    await sendMessages([{
      data: {
        groupId: normalizeText(groupId) || undefined,
        people,
      },
      role: 'user',
      text: nextMessage,
    }])

    return null
  }

  return {
    appendLocalMessage,
    chatId,
    confirmGroupSelection,
    error,
    groupId,
    loadChat,
    loadChats,
    loadingChat,
    messages,
    parsedReceipt,
    receipt,
    recentChats,
    reset,
    result,
    revise,
    setGroupSelectMessage,
    setPreviewMessage,
    splitRows,
    start,
    startFromFile,
    status,
    stop,
  }
}
