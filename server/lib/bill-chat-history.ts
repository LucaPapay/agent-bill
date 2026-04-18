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

export function createBillChatSeed(input: {
  imageBase64?: string
  people: string[]
  rawText?: string
  title: string
}) {
  const peopleLabel = input.people.join(', ')

  if (input.imageBase64) {
    return pushEntry([], 'user', `Uploaded a receipt for ${input.title} with ${peopleLabel}.`)
  }

  if (input.rawText) {
    return pushEntry([], 'user', `Started a text-based receipt split for ${input.title} with ${peopleLabel}.`)
  }

  return pushEntry([], 'user', `Started a split for ${input.title} with ${peopleLabel}.`)
}

export function appendBillChatReply(history: any[], message: string) {
  return pushEntry(history, 'user', message)
}

export function appendBillChatEvent(history: any[], payload: any) {
  if (payload.type === 'status') {
    return pushEntry(history, payload.phase === 'agent' ? 'penny' : 'log', payload.message)
  }

  if (payload.type === 'error') {
    return pushEntry(history, 'log', payload.message)
  }

  if (payload.type === 'receipt_extracted') {
    return pushEntry(
      history,
      'log',
      `Penny parsed ${payload.receipt.items.length} items from ${payload.receipt.merchant || 'the receipt'}.`,
    )
  }

  if (payload.type === 'agent_progress') {
    return pushEntry(history, 'penny', payload.message)
  }

  if (payload.type === 'agent_tool_start') {
    return pushEntry(history, 'log', `Tool: ${payload.toolName}`)
  }

  if (payload.type === 'complete') {
    return pushEntry(history, 'penny', payload.result?.summary || 'Split ready.')
  }

  return history
}
