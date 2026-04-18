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
  groupMemberIds,
  paidByPersonId,
  splitInputs,
  tipAmountCents,
  totalAmountCents,
}: {
  groupMemberIds: string[]
  paidByPersonId: string
  splitInputs: Array<{
    itemAmountCents: number
    personId: string
  }>
  tipAmountCents: number
  totalAmountCents: number
}) {
  if (!groupMemberIds.length) {
    throw new Error('Add at least one person to the group before creating a bill.')
  }

  if (!groupMemberIds.includes(paidByPersonId)) {
    throw new Error('The bill payer must belong to the selected group.')
  }

  const byPersonId = new Map(
    splitInputs.map(split => [
      split.personId,
      Math.max(0, Math.round(split.itemAmountCents)),
    ]),
  )

  const memberShares = groupMemberIds.map((personId: string) => ({
    itemAmountCents: byPersonId.get(personId) || 0,
    personId,
    tipAmountCents: 0,
    totalAmountCents: 0,
  }))

  const itemAmountCents = memberShares.reduce((sum: number, share) => sum + share.itemAmountCents, 0)

  if (itemAmountCents + tipAmountCents !== totalAmountCents) {
    throw new Error('Food splits plus tip must add up to the bill total.')
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
