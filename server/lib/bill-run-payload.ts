import { normalizeBillChatMessages } from './bill-chat-messages'

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function asObject(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null
}

export function normalizePeople(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(entry => normalizeText(entry))
    .filter(Boolean)
}

function normalizeSource(value: unknown) {
  const source = normalizeText(value)

  if (source === 'pi-agent-pending' || source === 'receipt-pending') {
    return 'penny-pending'
  }

  if (source === 'pi-agent-question') {
    return 'penny-question'
  }

  if (source === 'pi-agent-split') {
    return 'penny-split'
  }

  if (source === 'pi-agent-revision') {
    return 'penny-revision'
  }

  if (source === 'pi-agent-revision-error') {
    return 'penny-revision-error'
  }

  if (source === 'openai-image+pi-agent') {
    return 'openai-image+penny'
  }

  if (source === 'openai-text+pi-agent') {
    return 'openai-text+penny'
  }

  return source
}

function normalizeStatus(status: unknown, source: string) {
  const normalizedStatus = normalizeText(status)

  if (
    normalizedStatus === 'error'
    || normalizedStatus === 'needs_input'
    || normalizedStatus === 'ready'
    || normalizedStatus === 'running'
  ) {
    return normalizedStatus
  }

  if (source === 'penny-pending') {
    return 'running'
  }

  if (source === 'penny-message' || source === 'penny-question') {
    return 'needs_input'
  }

  if (source.endsWith('-error')) {
    return 'error'
  }

  return 'ready'
}

function buildMessages(payload: any) {
  return normalizeBillChatMessages(payload?.messages)
}

export function normalizeSavedRunPayload(value: unknown) {
  const payload: any = asObject(value)

  if (!payload) {
    return {
      billDate: '',
      billItems: [],
      currency: 'EUR',
      items: [],
      merchant: '',
      messages: [],
      notes: [],
      openai: { model: null, used: false },
      people: [],
      penny: { model: null, used: false },
      source: '',
      split: [],
      status: 'ready',
      summary: '',
      taxCents: 0,
      tipCents: 0,
      title: 'Untitled bill',
      totalCents: 0,
    }
  }

  const context = asObject(payload.context) || {}
  const receipt = asObject(payload.receipt) || asObject(context.receipt) || undefined
  const source = normalizeSource(payload.source || context.source)
  const normalizedPayload: any = {
    billDate: normalizeText(payload.billDate || context.billDate || receipt?.billDate),
    billItems: Array.isArray(payload.billItems)
      ? payload.billItems
      : Array.isArray(context.billItems)
        ? context.billItems
        : [],
    chatId: normalizeText(payload.chatId),
    currency: normalizeText(payload.currency || context.currency || receipt?.currency) || 'EUR',
    groupId: normalizeText(payload.groupId || context.groupId) || undefined,
    items: Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(context.items)
        ? context.items
        : Array.isArray(receipt?.items)
          ? receipt.items
          : [],
    merchant: normalizeText(payload.merchant || context.merchant || receipt?.merchant || payload.title || context.title),
    messages: buildMessages(payload),
    notes: Array.isArray(payload.notes)
      ? payload.notes
      : Array.isArray(context.notes)
        ? context.notes
        : Array.isArray(receipt?.notes)
          ? receipt.notes
          : [],
    openai: payload.openai && typeof payload.openai === 'object' && !Array.isArray(payload.openai)
      ? payload.openai
      : {
      model: null,
      used: false,
    },
    people: normalizePeople(Array.isArray(payload.people) && payload.people.length ? payload.people : context.people),
    penny: payload.penny && typeof payload.penny === 'object' && !Array.isArray(payload.penny)
      ? payload.penny
      : payload.pi && typeof payload.pi === 'object' && !Array.isArray(payload.pi)
        ? payload.pi
        : {
      model: null,
      used: false,
    },
    source,
    split: Array.isArray(payload.split)
      ? payload.split
      : Array.isArray(context.split)
        ? context.split
        : [],
    status: normalizeStatus(payload.status || context.status, source),
    summary: normalizeText(payload.summary || context.summary),
    taxCents: Number(payload.taxCents || context.taxCents || receipt?.taxCents || 0),
    tipCents: Number(payload.tipCents || context.tipCents || receipt?.tipCents || 0),
    title: normalizeText(payload.title || context.title || receipt?.merchant) || 'Untitled bill',
    totalCents: Number(payload.totalCents || context.totalCents || receipt?.totalCents || 0),
  }

  if ((payload as any).rawReceipt === null) {
    delete normalizedPayload.rawReceipt
  } else if ((payload as any).rawReceipt || (context as any).rawReceipt) {
    normalizedPayload.rawReceipt = (payload as any).rawReceipt || (context as any).rawReceipt
  }

  if (receipt) {
    normalizedPayload.receipt = receipt
  }

  if (!normalizedPayload.merchant) {
    normalizedPayload.merchant = normalizedPayload.title
  }

  return normalizedPayload
}

export function withRunMetadata(row: any) {
  return {
    ...normalizeSavedRunPayload(row.payload),
    runId: row.id,
    savedAt: row.created_at,
  }
}
