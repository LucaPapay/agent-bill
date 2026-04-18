import { normalizeBillDate } from './bill-date'

function toCents(value: string | number | undefined | null) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value))
  }

  const normalized = String(value || '')
    .trim()
    .replace(/[^0-9,.-]/g, '')
    .replace(',', '.')

  const amount = Number.parseFloat(normalized)

  if (!Number.isFinite(amount)) {
    return 0
  }

  return Math.max(0, Math.round(amount * 100))
}

export function normalizePeople(people: string[]) {
  return [...new Set(
    people
      .map((value: string) => String(value || '').trim())
      .filter(Boolean)
  )]
}

export function splitEvenly(totalCents: number, people: string[]) {
  if (!people.length) {
    return []
  }

  const base = Math.floor(totalCents / people.length)
  const remainder = totalCents % people.length

  return people.map((person: string, index: number) => ({
    person,
    amountCents: base + (index < remainder ? 1 : 0),
    note: 'Even split because item ownership is still unknown.',
  }))
}

function normalizeItems(items: any[]) {
  return items
    .map((item: any, index: number) => ({
      name: String(item?.name || `Item ${index + 1}`).trim() || `Item ${index + 1}`,
      amountCents: toCents(item?.amountCents ?? item?.priceCents ?? item?.amount ?? item?.price),
      quantity: Math.max(1, Math.round(Number(item?.quantity || 1))),
    }))
    .filter((item: any) => item.amountCents > 0)
}

function scaleMoney(value: number, scale: number) {
  if (!value || scale === 1) {
    return value
  }

  return Math.max(0, Math.round(value / scale))
}

function inferReceiptMoneyScale(itemSubtotalCents: number, subtotalCents: number, totalCents: number) {
  if (!itemSubtotalCents) {
    return 1
  }

  for (const scale of [100, 10]) {
    const scaledSubtotal = scaleMoney(subtotalCents, scale)
    const scaledTotal = scaleMoney(totalCents, scale)

    if (scaledTotal >= itemSubtotalCents * 0.9 && scaledTotal <= itemSubtotalCents * 1.25) {
      return scale
    }

    if (scaledSubtotal >= itemSubtotalCents * 0.85 && scaledSubtotal <= itemSubtotalCents * 1.15) {
      return scale
    }
  }

  return 1
}

function normalizeSplit(split: any[] | undefined, people: string[], totalCents: number) {
  const fallback = splitEvenly(totalCents, people)

  if (!Array.isArray(split) || !split.length) {
    return fallback
  }

  const byPerson = new Map()

  for (const entry of split) {
    const name = String(entry?.person || '').trim()

    if (!people.includes(name)) {
      continue
    }

    byPerson.set(name, {
      person: name,
      amountCents: toCents(entry?.amountCents ?? entry?.amount ?? entry?.share),
      note: String(entry?.note || '').trim() || undefined,
    })
  }

  if (byPerson.size !== people.length) {
    return fallback
  }

  const normalized = people.map((person: string) => byPerson.get(person))
  const total = normalized.reduce((sum: number, entry: any) => sum + entry.amountCents, 0)

  if (total !== totalCents) {
    return fallback
  }

  return normalized
}

function buildSummary(itemCount: number, totalCents: number, mode: string) {
  if (!itemCount) {
    return `No structured items were found, so the app kept the split minimal and spread ${totalCents / 100} evenly.`
  }

  return `Parsed ${itemCount} bill line item${itemCount === 1 ? '' : 's'} and produced a ${mode} split.`
}

function buildReceiptSummary(merchant: string, itemCount: number) {
  if (!itemCount) {
    return 'No structured bill items were found yet.'
  }

  return `Parsed ${itemCount} bill item${itemCount === 1 ? '' : 's'} from ${merchant || 'the receipt'}.`
}

export function createLocalAnalysis({ title, people, rawText, imageProvided, notes = [] as string[] }: {
  title: string
  people: string[]
  rawText?: string
  imageProvided: boolean
  notes?: string[]
}) {
  const lines = String(rawText || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const billDate = lines
    .map(line => normalizeBillDate(line))
    .find(Boolean) || ''

  const items = []
  let taxCents = 0
  let tipCents = 0
  let totalCents = 0

  for (const line of lines) {
    const matches = [...line.matchAll(/-?\d+(?:[.,]\d{2})/g)]

    if (!matches.length) {
      continue
    }

    const lastMatch = matches.at(-1)?.[0] || ''
    const amount = toCents(lastMatch)
    const label: string = line.replace(lastMatch, '').replace(/[.:\-–]+$/, '').trim() || `Item ${items.length + 1}`
    const lower = label.toLowerCase()

    if (lower.includes('subtotal')) {
      continue
    }

    if (lower.includes('total')) {
      totalCents = amount
      continue
    }

    if (lower.includes('tax') || lower.includes('vat')) {
      taxCents += amount
      continue
    }

    if (lower.includes('tip') || lower.includes('gratuity')) {
      tipCents += amount
      continue
    }

    items.push({ name: label, amountCents: amount })
  }

  const normalizedItems = normalizeItems(items)
  const subtotalCents = normalizedItems.reduce((sum: number, item: any) => sum + item.amountCents, 0)
  const resolvedTotalCents = totalCents || subtotalCents + taxCents + tipCents

  if (imageProvided && !rawText) {
    notes.push('An image was uploaded, but no AI key was available, so image-only analysis was skipped.')
  }

  if (!normalizedItems.length && !resolvedTotalCents) {
    notes.push('Paste OCR text or add OPENAI_API_KEY if you want the app to read receipt images.')
  }

  return {
    billDate,
    currency: 'EUR',
    title,
    items: normalizedItems,
    merchant: title,
    notes,
    openai: {
      model: null,
      used: false,
    },
    people,
    pi: {
      model: null,
      used: false,
    },
    source: rawText ? 'local-text' : 'local-empty',
    split: [],
    summary: buildReceiptSummary(title, normalizedItems.length),
    taxCents,
    tipCents,
    totalCents: resolvedTotalCents,
  }
}

export function createReceiptAnalysis({ title, people, receipt, imageProvided }: {
  title: string
  people: string[]
  receipt: any
  imageProvided: boolean
}) {
  return {
    billDate: receipt.billDate,
    currency: receipt.currency,
    items: receipt.items,
    merchant: receipt.merchant || title,
    notes: receipt.notes || [],
    openai: {
      model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
      used: true,
    },
    people,
    pi: {
      model: null,
      used: false,
    },
    receipt,
    source: imageProvided ? 'openai-image' : 'openai-text',
    split: [],
    summary: buildReceiptSummary(receipt.merchant || title, receipt.items.length),
    taxCents: receipt.taxCents,
    tipCents: receipt.tipCents,
    title,
    totalCents: receipt.totalCents,
  }
}

export function normalizePiAnalysis({ title, people, imageProvided, notes = [] as string[], piAnalysis }: {
  title: string
  people: string[]
  imageProvided: boolean
  notes?: string[]
  piAnalysis: any
}) {
  const items = normalizeItems(piAnalysis?.items || [])
  const taxCents = toCents(piAnalysis?.taxCents)
  const tipCents = toCents(piAnalysis?.tipCents)
  const computedTotal = items.reduce((sum: number, item: any) => sum + item.amountCents, 0) + taxCents + tipCents
  const totalCents = toCents(piAnalysis?.totalCents) || computedTotal

  return {
    billDate: '',
    currency: 'EUR',
    title,
    items,
    merchant: title,
    notes,
    openai: {
      model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
      used: false,
    },
    people,
    pi: {
      model: 'openai:gpt-4o-mini',
      used: true,
    },
    source: imageProvided ? 'pi-image' : 'pi-text',
    split: normalizeSplit(piAnalysis?.split, people, totalCents),
    summary: String(piAnalysis?.summary || buildSummary(items.length, totalCents, 'Pi-assisted')).trim(),
    taxCents,
    tipCents,
    totalCents,
  }
}

export function normalizeExtractedReceipt(receipt: any) {
  const items = normalizeItems(receipt?.items || [])
  const subtotalFromItems = items.reduce((sum: number, item: any) => sum + item.amountCents, 0)
  const rawSubtotalCents = toCents(receipt?.subtotalCents) || subtotalFromItems
  const rawTaxCents = toCents(receipt?.taxCents)
  const rawTipCents = toCents(receipt?.tipCents)
  const rawTotalCents = toCents(receipt?.totalCents) || rawSubtotalCents + rawTaxCents + rawTipCents
  const moneyScale = inferReceiptMoneyScale(subtotalFromItems, rawSubtotalCents, rawTotalCents)
  const subtotalCents = scaleMoney(rawSubtotalCents, moneyScale) || subtotalFromItems
  let taxCents = scaleMoney(rawTaxCents, moneyScale)
  const tipCents = scaleMoney(rawTipCents, moneyScale)
  const totalCents = scaleMoney(rawTotalCents, moneyScale) || subtotalCents + taxCents + tipCents
  const notes = Array.isArray(receipt?.notes)
    ? receipt.notes.map((note: any) => String(note).trim()).filter(Boolean)
    : []

  if (moneyScale > 1) {
    notes.push(`Normalized OpenAI money fields by ${moneyScale}x to match the item totals.`)
  }

  if (subtotalCents + tipCents <= totalCents && subtotalCents + taxCents + tipCents !== totalCents) {
    taxCents = totalCents - subtotalCents - tipCents
    notes.push('Adjusted tax cents to reconcile the extracted subtotal and total.')
  }

  return {
    billDate: normalizeBillDate(receipt?.billDate),
    currency: String(receipt?.currency || 'EUR').trim() || 'EUR',
    items,
    merchant: String(receipt?.merchant || '').trim(),
    notes,
    subtotalCents,
    taxCents,
    tipCents,
    totalCents,
  }
}

export function createAgentAnalysis({ title, people, plan, receipt, imageProvided }: {
  title: string
  people: string[]
  plan: any
  receipt: any
  imageProvided: boolean
}) {
  const notes = [
    ...(receipt?.notes || []),
    ...(plan?.notes || []),
  ]
    .map((note: any) => String(note || '').trim())
    .filter(Boolean)

  return {
    billDate: receipt.billDate,
    currency: receipt.currency,
    items: receipt.items,
    merchant: receipt.merchant || title,
    notes,
    openai: {
      model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
      used: true,
    },
    people,
    pi: {
      model: process.env.PI_AGENT_MODEL || 'gpt-4.1-mini',
      used: true,
    },
    receipt,
    source: imageProvided ? 'openai-image+pi-agent' : 'openai-text+pi-agent',
    split: normalizeSplit(plan?.split, people, receipt.totalCents),
    summary: String(plan?.summary || buildSummary(receipt.items.length, receipt.totalCents, 'agentic')).trim(),
    taxCents: receipt.taxCents,
    tipCents: receipt.tipCents,
    title,
    totalCents: receipt.totalCents,
  }
}
