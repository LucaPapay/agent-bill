function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function normalizeMessageData(data: any) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {}
  }

  const normalizedData: any = {}
  const groupId = normalizeText(data.groupId)
  const imageBase64 = normalizeText(data.imageBase64)
  const mimeType = normalizeText(data.mimeType)
  const people = Array.isArray(data.people)
    ? data.people.map((entry: any) => normalizeText(entry)).filter(Boolean)
    : []
  const rawText = normalizeText(data.rawText)
  const state = normalizeText(data.state)
  const title = normalizeText(data.title)
  const toolName = normalizeText(data.toolName)

  if (groupId) {
    normalizedData.groupId = groupId
  }

  if (imageBase64) {
    normalizedData.imageBase64 = imageBase64
  }

  if (mimeType) {
    normalizedData.mimeType = mimeType
  }

  if (people.length) {
    normalizedData.people = people
  }

  if (rawText) {
    normalizedData.rawText = rawText
  }

  if (state === 'done' || state === 'error' || state === 'running') {
    normalizedData.state = state
  }

  if (title) {
    normalizedData.title = title
  }

  if (toolName) {
    normalizedData.toolName = toolName
  }

  return normalizedData
}

function normalizeChatMessage(message: any) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return null
  }

  const role = String(message.role || 'user').trim()
  const text = normalizeText(message.text)
  const data = normalizeMessageData(message.data)

  if ((role !== 'assistant' && role !== 'user') || (!text && !Object.keys(data).length)) {
    return null
  }

  return {
    data,
    role,
    text,
  }
}

export function normalizeBillChatMessages(messages: any[]) {
  if (!Array.isArray(messages)) {
    return []
  }

  return messages
    .map(normalizeChatMessage)
    .filter(Boolean)
    .slice(-120)
}

export function appendBillChatMessages(existingMessages: any[], nextMessages: any[]) {
  return normalizeBillChatMessages([
    ...normalizeBillChatMessages(existingMessages),
    ...normalizeBillChatMessages(nextMessages),
  ])
}

export function appendBillChatAssistantMessage(messages: any[], text: string) {
  const normalizedText = normalizeText(text)
  const normalizedMessages = normalizeBillChatMessages(messages)
  const lastMessage = normalizedMessages[normalizedMessages.length - 1]

  if (!normalizedText) {
    return normalizedMessages
  }

  if (lastMessage?.role === 'assistant' && lastMessage.text === normalizedText) {
    return normalizedMessages
  }

  return appendBillChatMessages(normalizedMessages, [{
    role: 'assistant',
    text: normalizedText,
  }])
}

export function appendBillChatToolMessage(messages: any[], toolName: string) {
  const normalizedToolName = normalizeText(toolName)

  if (!normalizedToolName) {
    return normalizeBillChatMessages(messages)
  }

  return appendBillChatMessages(messages, [{
    data: {
      state: 'running',
      toolName: normalizedToolName,
    },
    role: 'assistant',
    text: '',
  }])
}

export function updateBillChatToolMessage(messages: any[], toolName: string, state: string) {
  const normalizedToolName = normalizeText(toolName)
  const normalizedMessages = normalizeBillChatMessages(messages)

  if (!normalizedToolName) {
    return normalizedMessages
  }

  for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
    const message = normalizedMessages[index]

    if (message?.data?.toolName !== normalizedToolName || message?.data?.state !== 'running') {
      continue
    }

    return normalizedMessages.map((entry: any, entryIndex: number) =>
      entryIndex === index
        ? {
            ...entry,
            data: {
              ...entry.data,
              state: state === 'error' ? 'error' : 'done',
            },
          }
        : entry,
    )
  }

  return appendBillChatMessages(normalizedMessages, [{
    data: {
      state: state === 'error' ? 'error' : 'done',
      toolName: normalizedToolName,
    },
    role: 'assistant',
    text: '',
  }])
}

export function failRunningBillChatToolMessages(messages: any[]) {
  const normalizedMessages = normalizeBillChatMessages(messages)

  return normalizedMessages.map((entry: any) =>
    entry?.data?.state === 'running'
      ? {
          ...entry,
          data: {
            ...entry.data,
            state: 'error',
          },
        }
      : entry,
  )
}
