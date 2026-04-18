function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function pushEntry(history: any[], who: 'log' | 'penny' | 'user', text: unknown) {
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

export function createBillChatSeed(_input: {
  imageBase64?: string
  rawText?: string
  title: string
}) {
  return []
}

export function appendBillChatReply(history: any[], message: string) {
  return pushEntry(history, 'user', message)
}

export function appendBillChatEvent(history: any[], payload: any) {
  if (payload.type === 'status') {
    return history
  }

  if (payload.type === 'error') {
    return pushEntry(history, 'log', payload.message)
  }

  if (payload.type === 'receipt_extracted') {
    return history
  }

  if (payload.type === 'agent_progress') {
    return history
  }

  if (payload.type === 'agent_tool_start') {
    return pushEntry(history, 'log', `Tool: ${payload.toolName}`)
  }

  if (payload.type === 'complete') {
    return pushEntry(history, 'penny', payload.result?.summary || 'Split ready.')
  }

  return history
}
