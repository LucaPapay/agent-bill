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

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

export function buildPennySystemPrompt() {
  return [
    'You are Penny, a bill-splitting agent.',
    'Use the available tools to extract or fix the receipt and submit a final split plan when you have enough information.',
    'Rules:',
    '- The split amounts must sum exactly to the receipt total.',
    '- The billItems must sum exactly to the receipt total.',
    '- Each billItem must have a short name, a positive amount, and one or more assignedPeople.',
    '- The split must exactly match the totals implied by billItems when each billItem is split evenly across its assignedPeople.',
    '- Shared food can be split across everyone when ownership is unclear.',
    '- Single-consumer drinks or desserts should only be assigned when there is a strong clue.',
    '- Keep original receipt item names when practical, but you may add short adjustment items for shared tax, tip, or rounding.',
    '- Respect explicit user instructions when they do not break the receipt total.',
    '- If the user only wants an explanation and no split change is needed, answer in plain text.',
    '- If one missing detail blocks the split, ask one short question in plain text.',
    '- Do not invent participant names.',
    '- Keep notes short and concrete.',
    '- Be decisive and pragmatic.',
  ].join('\n')
}

export function buildPennyUserMessage({
  groupId,
  latestMessage,
  people,
}: {
  groupId?: string
  latestMessage?: any
  people: string[]
}) {
  const text = normalizeText(latestMessage?.text)
  const data = latestMessage?.data && typeof latestMessage.data === 'object' && !Array.isArray(latestMessage.data)
    ? latestMessage.data
    : {}
  const lines = []

  if (text) {
    lines.push(text)
  }

  if (!text && (normalizeText(data.imageBase64) || normalizeText(data.rawText))) {
    lines.push('Read the uploaded receipt and produce the first practical split.')
  }

  if (!text && !lines.length) {
    lines.push('Continue the chat and do the next useful thing.')
  }

  if (groupId) {
    lines.push(`Selected group: ${groupId}`)
  }

  if (people.length) {
    lines.push(`Participants: ${people.join(', ')}`)
  }

  return lines.join('\n')
}

export function buildPennyContextMessage({
  groupId,
  people,
  receipt,
  split,
  title,
}: {
  groupId?: string
  people: string[]
  receipt?: any
  split?: any[]
  title: string
}) {
  const hasReceipt = Boolean(receipt)
  const hasSplit = Array.isArray(split) && split.length > 0

  if (!groupId && !people.length && !hasReceipt && !hasSplit) {
    return ''
  }

  return [
    `Saved chat context for "${title}":`,
    groupId ? `Selected group: ${groupId}` : '',
    people.length ? `Participants: ${people.join(', ')}` : '',
    hasReceipt ? `Saved receipt:\n${buildReceiptSummary(receipt)}` : '',
    hasSplit ? `Saved split:\n${buildCurrentSplitSummary(split || [], receipt?.currency || 'EUR')}` : '',
  ].filter(Boolean).join('\n\n')
}
