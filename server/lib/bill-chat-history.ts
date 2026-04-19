function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function normalizeMessageData(data: any, stripLargeFields = false) {
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

  if (imageBase64 && !stripLargeFields) {
    normalizedData.imageBase64 = imageBase64
  }

  if (mimeType) {
    normalizedData.mimeType = mimeType
  }

  if (people.length) {
    normalizedData.people = people
  }

  if (rawText && !stripLargeFields) {
    normalizedData.rawText = rawText
  }

  if (title) {
    normalizedData.title = title
  }

  return normalizedData
}

function normalizeChatMessage(message: any, stripLargeFields = false) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return null
  }

  const role = String(message.role || 'user').trim()
  const text = normalizeText(message.text)
  const data = normalizeMessageData(message.data, stripLargeFields)

  if ((role !== 'assistant' && role !== 'user') || (!text && !Object.keys(data).length)) {
    return null
  }

  return {
    data,
    role,
    text,
  }
}

function pushHistoryEntry(history: any[], who: 'log' | 'penny' | 'user', text: unknown) {
  const normalizedText = normalizeText(text)

  if (!normalizedText) {
    return history
  }

  return [
    ...history,
    {
      text: normalizedText,
      who,
    },
  ].slice(-120)
}

export function normalizeBillChatMessages(messages: any[], stripLargeFields = false) {
  if (!Array.isArray(messages)) {
    return []
  }

  return messages
    .map(message => normalizeChatMessage(message, stripLargeFields))
    .filter(Boolean)
    .slice(-120)
}

export function appendBillChatMessages(existingMessages: any[], nextMessages: any[], stripLargeFields = false) {
  return normalizeBillChatMessages([
    ...normalizeBillChatMessages(existingMessages, stripLargeFields),
    ...normalizeBillChatMessages(nextMessages, stripLargeFields),
  ], stripLargeFields)
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

export function buildBillChatHistory(messages: any[], errorMessage = '') {
  const normalizedMessages = normalizeBillChatMessages(messages)
  let history = normalizedMessages.reduce((nextHistory, message: any) => {
    if (!message.text) {
      return nextHistory
    }

    return pushHistoryEntry(
      nextHistory,
      message.role === 'assistant' ? 'penny' : 'user',
      message.text,
    )
  }, [] as any[])

  if (errorMessage) {
    history = pushHistoryEntry(history, 'log', errorMessage)
  }

  return history
}
