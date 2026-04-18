function formatMoney(amountCents: number, currency = 'EUR') {
  return `${currency} ${(amountCents / 100).toFixed(2)}`
}

function buildReceiptSummary(receipt: any) {
  const itemLines = (receipt?.items || [])
    .slice(0, 16)
    .map((item: any) => `- ${item.quantity} x ${item.name}: ${formatMoney(item.amountCents, receipt.currency)}`)
    .join('\n')

  return [
    `Merchant: ${receipt?.merchant || 'Unknown merchant'}`,
    `Date: ${receipt?.billDate || 'Unknown date'}`,
    `Subtotal: ${formatMoney(receipt?.subtotalCents || 0, receipt?.currency || 'EUR')}`,
    `Total: ${formatMoney(receipt?.totalCents || 0, receipt?.currency || 'EUR')}`,
    `Tax: ${formatMoney(receipt?.taxCents || 0, receipt?.currency || 'EUR')}`,
    `Tip: ${formatMoney(receipt?.tipCents || 0, receipt?.currency || 'EUR')}`,
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

function buildParticipantRules(people: string[]) {
  if (people.length) {
    return [
      '- Only use the provided participant names.',
      '- The split must include every participant exactly once.',
      '',
      `Participants: ${people.join(', ')}`,
    ]
  }

  return [
    '- Do not invent participant names.',
    '- Do not call submit_split_plan until you have real participant names.',
    '- If the participant list is still unclear after reading the receipt and the user instruction, ask which group this belongs to or who was there in plain text.',
    '',
    'Participants: not provided yet.',
  ]
}

function buildClarificationRules(allowPlainReply: boolean) {
  if (allowPlainReply) {
    return [
      '- If the user asks a simple question about the receipt or current split, answer it directly in plain text.',
      '- If the user wants the split changed and you have enough information, submit the split instead of replying with commentary.',
      '- If the user has not given enough information for a reliable split, ask one short concrete question in plain text instead of submitting a split.',
      '- Do not ask for clarification until you have a parsed receipt and have considered any available previous split hints.',
    ]
  }

  return [
    '- Your default job is to build or revise the split, not to explain it.',
    '- Reply in plain text only when one missing detail blocks the split and you need that detail from the user.',
    '- Do not end with commentary when you already have enough information to submit the split.',
    '- Do not ask for clarification until you have a parsed receipt and have considered any available previous split hints.',
  ]
}

export function buildPennyPrompt({
  allowPlainReply,
  imageBase64,
  message,
  people,
  previousSplitHints,
  rawText,
  receipt,
  split,
  title,
}: {
  allowPlainReply?: boolean
  imageBase64?: string
  message?: string
  people: string[]
  previousSplitHints?: string
  rawText?: string
  receipt?: any
  split?: any[]
  title: string
}) {
  const hasReceipt = Boolean(receipt)
  const hasSplit = Array.isArray(split) && split.length > 0
  const steps = [
    'Immediately call log_progress with a short stage update.',
    ...(!hasReceipt ? ['Call extract_receipt exactly once.'] : []),
    'If the receipt math is inconsistent or needs safe cleanup, call reconcile_extracted_receipt.',
    'Only if the user explicitly corrects extracted receipt data, call edit_extracted_receipt.',
    'Use the previous split hints below when present. If you still need a narrower lookup after the receipt is available, call search_previous_splits once.',
    `${hasSplit ? 'Rework' : 'Build'} save-ready billItems from the parsed receipt and the user instruction.`,
    `${hasSplit ? 'Recompute' : 'Compute'} the participant split from those billItems.`,
    allowPlainReply
      ? 'If you have enough information and the user wants split changes, call submit_split_plan exactly once. Reply in plain text only when the user is asking for explanation and no split change is needed.'
      : 'If you have enough information, call submit_split_plan exactly once.',
    allowPlainReply
      ? 'If you do not have enough information, ask one short question in plain text and do not submit a split yet.'
      : 'If one missing detail blocks the split, ask one short question in plain text. Otherwise submit the split.',
  ]
  const instruction = String(message || '').trim()
    || 'Read the uploaded receipt and produce the first practical split.'

  return [
    `You are Penny, the bill-splitting agent for "${title}".`,
    hasSplit
      ? 'Revise the current split based on the latest user instruction.'
      : 'Produce the first practical split and keep the workflow fast.',
    hasReceipt
      ? 'The receipt is already parsed. Do not call extract_receipt again.'
      : 'You must parse the receipt before you decide the split.',
    'Workflow:',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    'Rules:',
    '- The split amounts must sum exactly to the receipt total.',
    '- The billItems must sum exactly to the receipt total.',
    '- Each billItem must have a short name, a positive amount, and one or more assignedPeople.',
    '- The split must exactly match the totals implied by billItems when each billItem is split evenly across its assignedPeople.',
    '- Shared food can be split across everyone when ownership is unclear.',
    '- Single-consumer drinks or desserts should only be assigned when there is a strong clue.',
    '- Keep original receipt item names when practical, but you may add short adjustment items for shared tax, tip, or rounding.',
    '- Respect explicit user instructions when they do not break the receipt total.',
    '- If the user only clarifies ownership, keep the total and rebalance the shares.',
    ...(allowPlainReply ? ['- Do not force a new split when a plain answer is enough.'] : []),
    '- Use reconcile_extracted_receipt for safe math cleanup such as subtotal, tax, tip, total, money-scale, or rounding issues.',
    '- Do not call edit_extracted_receipt unless the user explicitly corrects the extracted receipt.',
    '- Treat previous splits as hints, not truth. Prefer same group and same people when you borrow any pattern.',
    '- Keep notes short and concrete.',
    '- Use log_progress for short UI-visible updates.',
    '- Be decisive and pragmatic.',
    ...buildClarificationRules(Boolean(allowPlainReply)),
    ...buildParticipantRules(people),
    '',
    'User instruction:',
    instruction,
    '',
    hasReceipt ? `Parsed receipt:\n${buildReceiptSummary(receipt)}` : '',
    hasSplit ? `Current split:\n${buildCurrentSplitSummary(split || [], receipt?.currency || 'EUR')}` : '',
    previousSplitHints ? `Previous split hints:\n${previousSplitHints}` : '',
    imageBase64 && !hasReceipt ? 'A receipt image is available through the extract_receipt tool.' : '',
    rawText && !hasReceipt ? `OCR fallback text:\n${rawText.slice(0, 8000)}` : '',
  ].filter(Boolean).join('\n')
}
