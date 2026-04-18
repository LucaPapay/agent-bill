type Transfer = {
  amountCents: number
  fromPersonId: string
  toPersonId: string
}

function compareOpenAmounts(
  left: { amountCents: number; personId: string },
  right: { amountCents: number; personId: string },
) {
  if (right.amountCents !== left.amountCents) {
    return right.amountCents - left.amountCents
  }

  return left.personId.localeCompare(right.personId)
}

export function simplifyGroupTransfers(transfers: Transfer[]) {
  const balanceByPersonId = new Map<string, number>()

  for (const transfer of transfers) {
    const amountCents = Math.max(0, Math.round(transfer.amountCents))

    if (amountCents <= 0 || transfer.fromPersonId === transfer.toPersonId) {
      continue
    }

    balanceByPersonId.set(
      transfer.fromPersonId,
      (balanceByPersonId.get(transfer.fromPersonId) || 0) - amountCents,
    )
    balanceByPersonId.set(
      transfer.toPersonId,
      (balanceByPersonId.get(transfer.toPersonId) || 0) + amountCents,
    )
  }

  const debtors: Array<{ amountCents: number; personId: string }> = []
  const creditors: Array<{ amountCents: number; personId: string }> = []

  for (const [personId, balanceCents] of balanceByPersonId.entries()) {
    if (balanceCents < 0) {
      debtors.push({
        amountCents: Math.abs(balanceCents),
        personId,
      })
      continue
    }

    if (balanceCents > 0) {
      creditors.push({
        amountCents: balanceCents,
        personId,
      })
    }
  }

  debtors.sort(compareOpenAmounts)
  creditors.sort(compareOpenAmounts)

  const simplifiedTransfers: Transfer[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]!
    const creditor = creditors[creditorIndex]!
    const amountCents = Math.min(debtor.amountCents, creditor.amountCents)

    simplifiedTransfers.push({
      amountCents,
      fromPersonId: debtor.personId,
      toPersonId: creditor.personId,
    })

    debtor.amountCents -= amountCents
    creditor.amountCents -= amountCents

    if (!debtor.amountCents) {
      debtorIndex += 1
    }

    if (!creditor.amountCents) {
      creditorIndex += 1
    }
  }

  return simplifiedTransfers
}
