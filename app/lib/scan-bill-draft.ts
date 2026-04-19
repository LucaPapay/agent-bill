import { centsToMoneyInput } from './ledger-bill-form'

function findMembership(group: any, personName: string) {
  const normalizedName = String(personName || '').trim().toLowerCase()

  if (!normalizedName) {
    return null
  }

  return (group?.memberships || []).find((membership: any) =>
    String(membership?.person?.name || '').trim().toLowerCase() === normalizedName,
  ) || null
}

function buildPlanDraftItems(group: any, result: any, seedBase: string) {
  if (!Array.isArray(result?.billItems)) {
    return []
  }

  return result.billItems.map((item: any, index: number) => {
    const assignedPersonIds = (item.assignedPeople || [])
      .map((personName: string) => findMembership(group, personName)?.personId || '')
      .filter(Boolean)

    if (!assignedPersonIds.length) {
      return null
    }

    return {
      amount: centsToMoneyInput(item.amountCents || 0),
      assignedPersonIds,
      id: `scan-plan-${seedBase}-${index}`,
      name: item.name || `Item ${index + 1}`,
    }
  }).filter(Boolean)
}

function buildSplitDraftItems(group: any, result: any, seedBase: string) {
  if (!Array.isArray(result?.split)) {
    return []
  }

  return result.split.map((row: any, index: number) => {
    const membership = findMembership(group, row.person)

    if (!membership) {
      return null
    }

    return {
      amount: centsToMoneyInput(row.amountCents || 0),
      assignedPersonIds: [membership.personId],
      id: `scan-split-${seedBase}-${index}`,
      name: `${row.person} share`,
    }
  }).filter(Boolean)
}

function buildParsedDraftItems(receipt: any, seedBase: string) {
  if (!Array.isArray(receipt?.items)) {
    return []
  }

  return receipt.items.map((item: any, index: number) => ({
    amount: centsToMoneyInput(item.amountCents || 0),
    assignedPersonIds: [],
    id: `scan-item-${seedBase}-${index}`,
    name: item.name || `Item ${index + 1}`,
  }))
}

export function buildScanBillComposerDraft({
  chatId = '',
  group,
  receipt,
  result,
}: {
  chatId?: string
  group: any
  receipt: any
  result: any
}) {
  if (!group || !receipt) {
    return null
  }

  const seedChatId = String(chatId || result?.chatId || '').trim()
  const seedRunId = String(result?.runId || '').trim()
  const seedBase = seedRunId || seedChatId || group.id
  const planDraftItems = buildPlanDraftItems(group, result, seedBase)
  const splitDraftItems = planDraftItems.length
    ? planDraftItems
    : buildSplitDraftItems(group, result, seedBase)
  const seedMode = planDraftItems.length
    ? 'plan'
    : splitDraftItems.length
    ? 'split'
    : 'parsed'

  return {
    draft: {
      billDate: receipt.billDate || '',
      billItems: splitDraftItems.length
        ? splitDraftItems
        : buildParsedDraftItems(receipt, seedBase),
      billPaidByPersonId: group.memberships?.[0]?.personId || '',
      sourceChatId: seedChatId,
      billTip: splitDraftItems.length ? '0.00' : centsToMoneyInput(receipt.tipCents || 0),
      billTitle: receipt.merchant || `${group.name} receipt`,
      billTotal: centsToMoneyInput(receipt.totalCents || 0),
      groupId: group.id,
    },
    seedKey: `${seedChatId || group.id}:${seedRunId || 'pending'}:${seedMode}`,
  }
}
