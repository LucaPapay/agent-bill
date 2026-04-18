function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateParts(year: number, month: number, day: number) {
  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return ''
  }

  const normalized = new Date(year, month - 1, day, 12)

  if (
    normalized.getFullYear() !== year
    || normalized.getMonth() !== month - 1
    || normalized.getDate() !== day
  ) {
    return ''
  }

  return `${year}-${pad(month)}-${pad(day)}`
}

function normalizeYear(value: number) {
  if (value >= 100) {
    return value
  }

  return value >= 70 ? 1900 + value : 2000 + value
}

export function normalizeBillDate(value: unknown) {
  const raw = String(value || '').trim()

  if (!raw) {
    return ''
  }

  const isoMatch = raw.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/)

  if (isoMatch) {
    return formatDateParts(
      Number.parseInt(isoMatch[1]!, 10),
      Number.parseInt(isoMatch[2]!, 10),
      Number.parseInt(isoMatch[3]!, 10),
    )
  }

  const numericMatch = raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)

  if (numericMatch) {
    const left = Number.parseInt(numericMatch[1]!, 10)
    const right = Number.parseInt(numericMatch[2]!, 10)
    const year = normalizeYear(Number.parseInt(numericMatch[3]!, 10))

    if (left > 12) {
      return formatDateParts(year, right, left)
    }

    if (right > 12) {
      return formatDateParts(year, left, right)
    }

    return formatDateParts(year, left, right)
  }

  const normalizedText = raw
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
    .replace(/\s+/g, ' ')
  const parsed = new Date(normalizedText)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return formatDateParts(
    parsed.getFullYear(),
    parsed.getMonth() + 1,
    parsed.getDate(),
  )
}
