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

export function buildBillLedger({
  billItems,
  groupMemberIds,
  paidByPersonId,
  tipAmountCents,
  totalAmountCents,
}: {
  billItems: Array<{
    amountCents: number
    assignedPersonIds: string[]
    name: string
  }>
  groupMemberIds: string[]
  paidByPersonId: string
  tipAmountCents: number
  totalAmountCents: number
}) {
  if (!groupMemberIds.length) {
    throw new Error('Add at least one person to the group before creating a bill.')
  }

  if (!groupMemberIds.includes(paidByPersonId)) {
    throw new Error('The bill payer must belong to the selected group.')
  }

  if (tipAmountCents > totalAmountCents) {
    throw new Error('Tip cannot be greater than the bill total.')
  }

  const groupMemberIdsSet = new Set(groupMemberIds)
  const itemAmountsByPersonId = new Map<string, number>(groupMemberIds.map(personId => [personId, 0]))
  const itemSubtotalCents = totalAmountCents - tipAmountCents

  if (itemSubtotalCents < 0) {
    throw new Error('Item subtotal cannot be negative.')
  }

  if (!billItems.length) {
    const evenItemAmounts = splitEvenly(itemSubtotalCents, groupMemberIds)

    for (const personId of groupMemberIds) {
      itemAmountsByPersonId.set(personId, evenItemAmounts.get(personId) || 0)
    }
  }

  for (const item of billItems) {
    const name = item.name.trim()

    if (!name) {
      throw new Error('Each bill item needs a name.')
    }

    const amountCents = Math.max(0, Math.round(item.amountCents))

    if (amountCents <= 0) {
      throw new Error(`"${name}" needs an amount greater than zero.`)
    }

    const assignedPersonIds = [...new Set(item.assignedPersonIds)]

    if (!assignedPersonIds.length) {
      throw new Error(`Assign "${name}" to at least one person.`)
    }

    for (const personId of assignedPersonIds) {
      if (!groupMemberIdsSet.has(personId)) {
        throw new Error(`"${name}" is assigned to someone outside the selected group.`)
      }
    }

    const splitAmounts = splitEvenly(amountCents, assignedPersonIds)

    for (const personId of assignedPersonIds) {
      itemAmountsByPersonId.set(
        personId,
        (itemAmountsByPersonId.get(personId) || 0) + (splitAmounts.get(personId) || 0),
      )
    }
  }

  const memberShares = groupMemberIds.map((personId: string) => ({
    itemAmountCents: itemAmountsByPersonId.get(personId) || 0,
    personId,
    tipAmountCents: 0,
    totalAmountCents: 0,
  }))

  const assignedItemAmountCents = memberShares.reduce((sum: number, share) => sum + share.itemAmountCents, 0)

  if (assignedItemAmountCents + tipAmountCents !== totalAmountCents) {
    throw new Error('Item amounts plus tip must add up to the bill total.')
  }

  const tipParticipants = memberShares
    .filter(share => share.itemAmountCents > 0)
    .map(share => share.personId)
  const sharedTip = splitEvenly(tipAmountCents, tipParticipants.length ? tipParticipants : groupMemberIds)

  for (const share of memberShares) {
    share.tipAmountCents = sharedTip.get(share.personId) || 0
    share.totalAmountCents = share.itemAmountCents + share.tipAmountCents
  }

  const transfers = memberShares
    .filter(share => share.personId !== paidByPersonId && share.totalAmountCents > 0)
    .map(share => ({
      amountCents: share.totalAmountCents,
      fromPersonId: share.personId,
      toPersonId: paidByPersonId,
    }))

  return {
    memberShares,
    transfers,
  }
}
