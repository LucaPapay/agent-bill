function formatMoney(amountCents: number, currency = 'EUR') {
  return `${currency} ${(amountCents / 100).toFixed(2)}`
}

function buildReceiptSummary(receipt: any) {
  const itemLines = (receipt?.items || [])
    .slice(0, 12)
    .map((item: any) => `- ${item.quantity} x ${item.name}: ${formatMoney(item.amountCents, receipt.currency)}`)
    .join('\n')

  return [
    `Merchant: ${receipt?.merchant || 'Unknown merchant'}`,
    `Date: ${receipt?.billDate || 'Unknown date'}`,
    `Total: ${formatMoney(receipt?.totalCents || 0, receipt?.currency || 'EUR')}`,
    'Items:',
    itemLines || '- No structured items found',
  ].join('\n')
}

function buildCurrentSplitSummary(split: any[], currency = 'EUR') {
  return split
    .map((entry: any) =>
      `- ${entry.person}: ${formatMoney(entry.amountCents || 0, currency)}${entry.note ? ` (${entry.note})` : ''}`)
    .join('\n')
}

function buildInstruction(message: string, groupId?: string, people: string[] = []) {
  const normalizedMessage = String(message || '').trim()

  if (normalizedMessage) {
    return normalizedMessage
  }

  if (groupId && people.length) {
    return `Use group ${groupId} with participants ${people.join(', ')} and continue the split.`
  }

  if (groupId) {
    return `Use group ${groupId} and continue the chat.`
  }

  if (people.length) {
    return `Use these participants and continue the split: ${people.join(', ')}.`
  }

  return 'Read the receipt and produce the first practical split.'
}

export function buildPennyPrompt({
  groupId,
  hasSessionMemory,
  message,
  people,
  rawText,
  receipt,
  split,
  title,
}: {
  groupId?: string
  hasSessionMemory?: boolean
  message?: string
  people: string[]
  rawText?: string
  receipt?: any
  split?: any[]
  title: string
}) {
  const hasReceipt = Boolean(receipt)
  const hasSplit = Array.isArray(split) && split.length > 0
  const instruction = buildInstruction(String(message || ''), groupId, people)

  return [
    `You are Penny, the bill-splitting agent for "${title}".`,
    'Use the available tools to extract or fix the receipt and submit a final split plan when you have enough information.',
    'If the user only wants an explanation and no split change is needed, answer in plain text.',
    'If one missing detail blocks the split, ask one short question in plain text.',
    groupId ? `Selected group: ${groupId}` : 'No group has been selected yet.',
    people.length
      ? `Participants: ${people.join(', ')}`
      : 'Participants are still unknown. Do not invent names.',
    '',
    'User instruction:',
    instruction,
    '',
    !hasSessionMemory && hasReceipt ? `Saved receipt:\n${buildReceiptSummary(receipt)}` : '',
    !hasSessionMemory && hasSplit ? `Saved split:\n${buildCurrentSplitSummary(split || [], receipt?.currency || 'EUR')}` : '',
    !hasSessionMemory && rawText && !hasReceipt ? `OCR fallback text:\n${rawText.slice(0, 8000)}` : '',
    !hasSessionMemory && !hasReceipt ? 'A receipt image may be available through the extract_receipt tool.' : '',
  ].filter(Boolean).join('\n')
}
