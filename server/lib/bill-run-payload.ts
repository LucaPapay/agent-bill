function parseJsonValue(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  if (!value) {
    return value
  }

  return JSON.parse(value)
}

export function normalizePeople(value: unknown) {
  const parsedValue = parseJsonValue(value)

  if (!Array.isArray(parsedValue)) {
    return []
  }

  return parsedValue
    .map(entry => String(entry || '').trim())
    .filter(Boolean)
}

export function normalizeSavedRunPayload(value: unknown) {
  const payload = parseJsonValue(value)

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      billItems: [],
    }
  }

  const normalizedPayload: any = { ...payload }

  if (!Array.isArray(normalizedPayload.billItems)) {
    normalizedPayload.billItems = []
  }

  if (!normalizedPayload.penny && normalizedPayload.pi) {
    normalizedPayload.penny = normalizedPayload.pi
  }

  if (normalizedPayload.source === 'pi-agent-pending' || normalizedPayload.source === 'receipt-pending') {
    normalizedPayload.source = 'penny-pending'
  }

  if (normalizedPayload.source === 'pi-agent-question') {
    normalizedPayload.source = 'penny-question'
  }

  if (normalizedPayload.source === 'pi-agent-split') {
    normalizedPayload.source = 'penny-split'
  }

  if (normalizedPayload.source === 'pi-agent-revision') {
    normalizedPayload.source = 'penny-revision'
  }

  if (normalizedPayload.source === 'pi-agent-revision-error') {
    normalizedPayload.source = 'penny-revision-error'
  }

  if (normalizedPayload.source === 'openai-image+pi-agent') {
    normalizedPayload.source = 'openai-image+penny'
  }

  if (normalizedPayload.source === 'openai-text+pi-agent') {
    normalizedPayload.source = 'openai-text+penny'
  }

  if ((payload as any).rawReceipt === null) {
    delete normalizedPayload.rawReceipt
  }

  if ((payload as any).receipt !== null) {
    return normalizedPayload
  }

  delete normalizedPayload.receipt
  return normalizedPayload
}

export function withRunMetadata(row: any) {
  return {
    ...normalizeSavedRunPayload(row.payload),
    runId: row.id,
    savedAt: row.created_at,
  }
}
