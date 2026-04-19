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
  const title = normalizeText(data.title)

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

  if (title) {
    normalizedData.title = title
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
