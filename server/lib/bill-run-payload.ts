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
    return {}
  }

  if ((payload as any).receipt !== null) {
    return payload
  }

  const normalizedPayload: any = { ...payload }
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
