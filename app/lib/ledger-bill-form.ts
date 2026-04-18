export function todayBillDate() {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function centsToMoneyInput(cents: number) {
  return ((cents || 0) / 100).toFixed(2).replace('.', ',')
}

export function toCents(value: string | number | undefined | null) {
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

function splitEvenly(amountCents: number, personIds: string[]) {
  if (!personIds.length || amountCents <= 0) {
    return new Map<string, number>()
  }

  const base = Math.floor(amountCents / personIds.length)
  const remainder = amountCents % personIds.length
  const result = new Map<string, number>()

  for (const [index, personId] of personIds.entries()) {
    result.set(personId, base + (index < remainder ? 1 : 0))
  }

  return result
}

export function normalizeAssignedPersonIds(group: any, personIds: string[]) {
  const allowedIds = new Set((group?.memberships || []).map((membership: any) => membership.personId))
  const normalized: string[] = []

  for (const personId of personIds) {
    if (!allowedIds.has(personId) || normalized.includes(personId)) {
      continue
    }

    normalized.push(personId)
  }

  return normalized
}

export function createEmptyBillItem(group: any, nextId: () => string) {
  const firstPersonId = group?.memberships?.[0]?.personId

  return {
    amount: '',
    assignedPersonIds: firstPersonId ? [firstPersonId] : [],
    id: nextId(),
    name: '',
  }
}

export function prepareBillItems(group: any, items: any[]) {
  const preparedItems = items.map((item) => {
    const name = String(item?.name || '').trim()
    const amountCents = toCents(item?.amount)
    const assignedPersonIds = normalizeAssignedPersonIds(group, item?.assignedPersonIds || [])
    const hasAnyInput = Boolean(name || amountCents > 0)
    const isComplete = Boolean(name && amountCents > 0 && assignedPersonIds.length)

    return {
      amountCents,
      assignedPersonIds,
      hasAnyInput,
      id: String(item?.id || ''),
      isComplete,
      name,
    }
  })

  return {
    hasIncompleteItems: preparedItems.some(item => item.hasAnyInput && !item.isComplete),
    payloadItems: preparedItems
      .filter(item => item.isComplete)
      .map(item => ({
        amountCents: item.amountCents,
        assignedPersonIds: item.assignedPersonIds,
        name: item.name,
      })),
  }
}

export function buildPreviewShares(group: any, payloadItems: any[], tipAmountCents: number, totalAmountCents: number) {
  const memberships = group?.memberships || []
  const itemAmountsByPersonId = new Map<string, number>(
    memberships.map((membership: any) => [membership.personId, 0]),
  )

  for (const item of payloadItems) {
    const splitAmounts = splitEvenly(item.amountCents, item.assignedPersonIds)

    for (const personId of item.assignedPersonIds) {
      itemAmountsByPersonId.set(
        personId,
        (itemAmountsByPersonId.get(personId) || 0) + (splitAmounts.get(personId) || 0),
      )
    }
  }

  if (!payloadItems.length && memberships.length) {
    const evenItemAmounts = splitEvenly(
      Math.max(0, totalAmountCents - tipAmountCents),
      memberships.map((membership: any) => membership.personId),
    )

    for (const membership of memberships) {
      itemAmountsByPersonId.set(membership.personId, evenItemAmounts.get(membership.personId) || 0)
    }
  }

  const tipParticipants = memberships
    .map((membership: any) => membership.personId)
    .filter((personId: string) => (itemAmountsByPersonId.get(personId) || 0) > 0)
  const sharedTip = splitEvenly(
    tipAmountCents,
    tipParticipants.length ? tipParticipants : memberships.map((membership: any) => membership.personId),
  )

  return memberships.map((membership: any) => {
    const itemAmountCents = itemAmountsByPersonId.get(membership.personId) ?? 0
    const sharedTipCents = sharedTip.get(membership.personId) ?? 0

    return {
      itemAmountCents,
      person: membership.person,
      personId: membership.personId,
      tipAmountCents: sharedTipCents,
      totalAmountCents: itemAmountCents + sharedTipCents,
    }
  })
}
