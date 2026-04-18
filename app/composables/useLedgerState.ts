import { computed } from 'vue'

let loadingPromise: Promise<void> | null = null

export function useLedgerState() {
  const api = useOrpc()

  const ledger = useState<any>('ledger-state:ledger', () => ({
    groups: [],
    people: [],
  }))
  const health = useState<any>('ledger-state:health', () => null)
  const errorMessage = useState('ledger-state:error', () => '')
  const saving = useState('ledger-state:saving', () => false)
  const ledgerLoaded = useState('ledger-state:ledger-loaded', () => false)
  const healthLoaded = useState('ledger-state:health-loaded', () => false)

  const selectedGroupId = useState('ledger-state:selected-group-id', () => '')
  const selectedBillId = useState('ledger-state:selected-bill-id', () => '')

  const personName = useState('ledger-state:person-name', () => '')
  const groupName = useState('ledger-state:group-name', () => '')
  const personToAddId = useState('ledger-state:person-to-add-id', () => '')

  const billTitle = useState('ledger-state:bill-title', () => 'Friday dinner')
  const billTotal = useState('ledger-state:bill-total', () => '0')
  const billTip = useState('ledger-state:bill-tip', () => '0')
  const billPaidByPersonId = useState('ledger-state:bill-paid-by-person-id', () => '')
  const billItems = useState<Array<{
    amount: string
    assignedPersonIds: string[]
    id: string
    name: string
  }>>('ledger-state:bill-items', () => [])
  const resultLayout = useState('ledger-state:result-layout', () => 'cards')
  const billItemId = useState('ledger-state:bill-item-id', () => 0)

  const accentPalette = ['var(--tomato)', 'var(--marigold)', 'var(--mint)', 'var(--lilac)', 'var(--sky)']

  const selectedGroup = computed(() =>
    ledger.value.groups.find((group: any) => group.id === selectedGroupId.value) || null,
  )

  const selectedBill = computed(() =>
    selectedGroup.value?.bills.find((bill: any) => bill.id === selectedBillId.value) || null,
  )

  const selectedGroupBillTransfers = computed(() =>
    selectedGroup.value?.billTransfers || [],
  )

  const selectedGroupSimplifiedTransfers = computed(() =>
    selectedGroup.value?.simplifiedTransfers || [],
  )

  const selectedGroupSettlementPayments = computed(() =>
    selectedGroup.value?.settlementPayments || [],
  )

  const selectedGroupSimplifiedTotalCents = computed(() =>
    selectedGroupSimplifiedTransfers.value.reduce((sum: number, transfer: any) => sum + transfer.amountCents, 0),
  )

  const selectedGroupMemberIds = computed(() =>
    (selectedGroup.value?.memberships || []).map((membership: any) => membership.personId),
  )

  const peopleNotInSelectedGroup = computed(() => {
    const memberIds = new Set(selectedGroupMemberIds.value)
    return ledger.value.people.filter((person: any) => !memberIds.has(person.id))
  })

  const billItemsSubtotalCents = computed(() =>
    billItems.value.reduce((sum: number, item) => sum + toCents(item.amount), 0),
  )

  const billTipCents = computed(() => toCents(billTip.value))
  const billTotalCents = computed(() => toCents(billTotal.value))
  const billRemainingCents = computed(() => billTotalCents.value - billTipCents.value - billItemsSubtotalCents.value)

  const billPreviewShares = computed(() =>
    buildPreviewShares(selectedGroup.value, billItems.value, billTipCents.value, billTotalCents.value),
  )

  const allBills = computed(() =>
    ledger.value.groups.flatMap((group: any) =>
      group.bills.map((bill: any) => ({
        ...bill,
        groupId: group.id,
        groupName: group.name,
      })),
    ),
  )

  const recentBillActivities = computed(() =>
    allBills.value.slice(0, 4).map((bill: any, index: number) => ({
      accent: accentPalette[index % accentPalette.length],
      amount: formatCents(bill.totalAmountCents),
      billId: bill.id,
      emoji: ['🧾', '🍽️', '🏠', '💸'][index % 4],
      groupId: bill.groupId,
      sub: `${bill.groupName} · paid by ${bill.paidByPerson?.name || 'Unknown'}`,
      title: bill.title,
    })),
  )

  const totalOpenAmountCents = computed(() =>
    ledger.value.groups.reduce(
      (sum: number, group: any) =>
        sum + (group.simplifiedTransfers || []).reduce((groupSum: number, transfer: any) => groupSum + transfer.amountCents, 0),
      0,
    ),
  )

  const totalBills = computed(() => allBills.value.length)

  const homeSummary = computed(() => ({
    dateLabel: new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    }).format(new Date()),
    groupsCount: ledger.value.groups.length,
    openAmountLabel: formatCents(totalOpenAmountCents.value),
    pendingPayments: ledger.value.groups.reduce(
      (sum: number, group: any) => sum + (group.simplifiedTransfers || []).length,
      0,
    ),
    peopleCount: ledger.value.people.length,
    totalBills: totalBills.value,
  }))

  const canAddPersonToGroup = computed(() =>
    Boolean(selectedGroupId.value && personToAddId.value),
  )

  const canCreateBill = computed(() =>
    Boolean(
      selectedGroup.value
      && selectedGroup.value.memberships.length
      && billTitle.value.trim()
      && billPaidByPersonId.value
      && billTotalCents.value > 0,
    ),
  )

  function nextBillItemId() {
    billItemId.value += 1
    return `bill-item-${billItemId.value}`
  }

  function toCents(value: string | number | undefined | null) {
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

  function formatCents(cents: number) {
    return new Intl.NumberFormat('en-US', {
      currency: 'EUR',
      style: 'currency',
    }).format((cents || 0) / 100)
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

  function normalizeAssignedPersonIds(group: any, personIds: string[]) {
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

  function createEmptyBillItem(group: any) {
    const firstPersonId = group?.memberships?.[0]?.personId

    return {
      amount: '',
      assignedPersonIds: firstPersonId ? [firstPersonId] : [],
      id: nextBillItemId(),
      name: '',
    }
  }

  function buildPreviewShares(group: any, items: any[], tipAmountCents: number, totalAmountCents: number) {
    const memberships = group?.memberships || []
    const itemAmountsByPersonId = new Map<string, number>(
      memberships.map((membership: any) => [membership.personId, 0]),
    )
    let hasAssignedItems = false

    for (const item of items) {
      const amountCents = toCents(item.amount)
      const assignedPersonIds = normalizeAssignedPersonIds(group, item.assignedPersonIds || [])

      if (amountCents <= 0 || !assignedPersonIds.length) {
        continue
      }

      const splitAmounts = splitEvenly(amountCents, assignedPersonIds)
      hasAssignedItems = true

      for (const personId of assignedPersonIds) {
        itemAmountsByPersonId.set(
          personId,
          (itemAmountsByPersonId.get(personId) || 0) + (splitAmounts.get(personId) || 0),
        )
      }
    }

    if (!hasAssignedItems && memberships.length) {
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

  function getGroupById(groupId: string) {
    return ledger.value.groups.find((group: any) => group.id === groupId) || null
  }

  function getBillById(groupId: string, billId: string) {
    return getGroupById(groupId)?.bills.find((bill: any) => bill.id === billId) || null
  }

  function applyLedger(nextLedger: any) {
    ledger.value = nextLedger

    if (!selectedGroupId.value && nextLedger.groups.length) {
      selectedGroupId.value = nextLedger.groups[0].id
    }

    if (!nextLedger.groups.find((group: any) => group.id === selectedGroupId.value)) {
      selectedGroupId.value = nextLedger.groups[0]?.id || ''
    }

    syncBillForm(nextLedger.groups.find((group: any) => group.id === selectedGroupId.value) || null)
  }

  function syncBillForm(group: any) {
    const members = group?.memberships || []

    if (!billItems.value.length) {
      billItems.value = [createEmptyBillItem(group)]
    }
    else {
      billItems.value = billItems.value.map(item => {
        const assignedPersonIds = normalizeAssignedPersonIds(group, item.assignedPersonIds || [])

        return {
          amount: item.amount,
          assignedPersonIds: assignedPersonIds.length || !members.length
            ? assignedPersonIds
            : [members[0].personId],
          id: item.id || nextBillItemId(),
          name: item.name,
        }
      })
    }

    if (!members.some((membership: any) => membership.personId === billPaidByPersonId.value)) {
      billPaidByPersonId.value = members[0]?.personId || ''
    }

    if (!members.some((membership: any) => membership.personId === personToAddId.value)) {
      personToAddId.value = peopleNotInSelectedGroup.value[0]?.id || ''
    }

    if (!group?.bills.find((bill: any) => bill.id === selectedBillId.value)) {
      selectedBillId.value = group?.bills[0]?.id || ''
    }
  }

  function setSelectedGroup(groupId: string) {
    selectedGroupId.value = groupId
    syncBillForm(getGroupById(groupId))
  }

  function setSelectedBill(groupId: string, billId: string) {
    setSelectedGroup(groupId)
    selectedBillId.value = billId
  }

  function resetBillForm() {
    billTitle.value = 'Friday dinner'
    billTotal.value = '0'
    billTip.value = '0'
    billItems.value = []
    syncBillForm(selectedGroup.value)
  }

  function loadBillFormFromBill(groupId: string, billId: string, options?: { duplicate?: boolean }) {
    const bill = getBillById(groupId, billId)

    if (!bill) {
      return false
    }

    setSelectedGroup(groupId)
    selectedBillId.value = bill.id
    billTitle.value = options?.duplicate ? `${bill.title} copy` : bill.title
    billTotal.value = String((bill.totalAmountCents || 0) / 100)
    billTip.value = String((bill.tipAmountCents || 0) / 100)
    billPaidByPersonId.value = bill.paidByPersonId
    billItems.value = bill.items.length
      ? bill.items.map((item: any) => ({
          amount: String((item.amountCents || 0) / 100),
          assignedPersonIds: [...(item.assignedPersonIds || [])],
          id: nextBillItemId(),
          name: item.name,
        }))
      : [createEmptyBillItem(selectedGroup.value)]

    return true
  }

  function addBillItem() {
    billItems.value.push(createEmptyBillItem(selectedGroup.value))
  }

  function removeBillItem(itemId: string) {
    billItems.value = billItems.value.filter(item => item.id !== itemId)

    if (!billItems.value.length) {
      billItems.value = [createEmptyBillItem(selectedGroup.value)]
    }
  }

  function updateBillItemName(itemId: string, value: string) {
    const item = billItems.value.find(entry => entry.id === itemId)

    if (item) {
      item.name = value
    }
  }

  function updateBillItemAmount(itemId: string, value: string) {
    const item = billItems.value.find(entry => entry.id === itemId)

    if (item) {
      item.amount = value
    }
  }

  function toggleBillItemAssignment(itemId: string, personId: string) {
    const item = billItems.value.find(entry => entry.id === itemId)

    if (!item) {
      return
    }

    if (item.assignedPersonIds.includes(personId)) {
      item.assignedPersonIds = item.assignedPersonIds.filter((value: string) => value !== personId)
      return
    }

    item.assignedPersonIds = [...item.assignedPersonIds, personId]
  }

  function loadHealth() {
    if (healthLoaded.value) {
      return Promise.resolve()
    }

    return api.health().then((value: any) => {
      health.value = value
      healthLoaded.value = true
    })
  }

  function loadLedger() {
    return api.getLedger().then(
      (value: any) => {
        applyLedger(value)
        ledgerLoaded.value = true
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not load the local ledger.'
      },
    )
  }

  function ensureLoaded() {
    if (ledgerLoaded.value && healthLoaded.value) {
      return Promise.resolve()
    }

    if (!loadingPromise) {
      loadingPromise = Promise.all([
        loadHealth(),
        loadLedger(),
      ]).then(() => undefined).finally(() => {
        loadingPromise = null
      })
    }

    return loadingPromise
  }

  function createPerson() {
    errorMessage.value = ''
    saving.value = true

    return api.createLedgerPerson({
      name: personName.value,
    }).then(
      (value: any) => {
        personName.value = ''
        applyLedger(value)
        return value
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not create the person.'
        return null
      },
    ).finally(() => {
      saving.value = false
    })
  }

  function createGroup() {
    errorMessage.value = ''
    saving.value = true

    return api.createLedgerGroup({
      name: groupName.value,
    }).then(
      (value: any) => {
        groupName.value = ''
        selectedGroupId.value = value.groupId
        applyLedger(value.ledger)
        return value
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not create the group.'
        return null
      },
    ).finally(() => {
      saving.value = false
    })
  }

  function addPersonToGroup() {
    if (!selectedGroupId.value || !personToAddId.value) {
      return Promise.resolve(null)
    }

    errorMessage.value = ''
    saving.value = true

    return api.addLedgerPersonToGroup({
      groupId: selectedGroupId.value,
      personId: personToAddId.value,
    }).then(
      (value: any) => {
        applyLedger(value)
        return value
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not add the person to the group.'
        return null
      },
    ).finally(() => {
      saving.value = false
    })
  }

  function createBill() {
    if (!selectedGroupId.value) {
      return Promise.resolve(null)
    }

    errorMessage.value = ''
    saving.value = true

    const payloadItems = billItems.value
      .map(item => ({
        amountCents: toCents(item.amount),
        assignedPersonIds: normalizeAssignedPersonIds(selectedGroup.value, item.assignedPersonIds || []),
        name: item.name.trim(),
      }))
      .filter(item => item.name || item.amountCents > 0)

    return api.createLedgerBill({
      billItems: payloadItems,
      groupId: selectedGroupId.value,
      paidByPersonId: billPaidByPersonId.value,
      tipAmountCents: billTipCents.value,
      title: billTitle.value,
      totalAmountCents: billTotalCents.value,
    }).then(
      (value: any) => {
        selectedBillId.value = value.billId
        applyLedger(value.ledger)
        resetBillForm()
        return value
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not save the bill.'
        return null
      },
    ).finally(() => {
      saving.value = false
    })
  }

  function updateBill(billId: string) {
    if (!selectedGroupId.value) {
      return Promise.resolve(null)
    }

    errorMessage.value = ''
    saving.value = true

    const payloadItems = billItems.value
      .map(item => ({
        amountCents: toCents(item.amount),
        assignedPersonIds: normalizeAssignedPersonIds(selectedGroup.value, item.assignedPersonIds || []),
        name: item.name.trim(),
      }))
      .filter(item => item.name || item.amountCents > 0)

    return api.updateLedgerBill({
      billId,
      billItems: payloadItems,
      groupId: selectedGroupId.value,
      paidByPersonId: billPaidByPersonId.value,
      tipAmountCents: billTipCents.value,
      title: billTitle.value,
      totalAmountCents: billTotalCents.value,
    }).then(
      (value: any) => {
        selectedBillId.value = value.billId
        applyLedger(value.ledger)
        return value
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not update the bill.'
        return null
      },
    ).finally(() => {
      saving.value = false
    })
  }

  function deleteBill(billId: string) {
    errorMessage.value = ''
    saving.value = true

    return api.deleteLedgerBill({
      billId,
    }).then(
      (value: any) => {
        applyLedger(value.ledger)
        return value
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not delete the bill.'
        return null
      },
    ).finally(() => {
      saving.value = false
    })
  }

  function recordSettlementPayment({
    amountCents,
    fromPersonId,
    toPersonId,
  }: {
    amountCents: number
    fromPersonId: string
    toPersonId: string
  }) {
    if (!selectedGroupId.value) {
      return Promise.resolve(null)
    }

    errorMessage.value = ''
    saving.value = true

    return api.recordSettlementPayment({
      amountCents,
      fromPersonId,
      groupId: selectedGroupId.value,
      toPersonId,
    }).then(
      (value: any) => {
        applyLedger(value)
        return value
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not save the settlement payment.'
        return null
      },
    ).finally(() => {
      saving.value = false
    })
  }

  function undoSettlementPayment(paymentId: string) {
    errorMessage.value = ''
    saving.value = true

    return api.undoSettlementPayment({
      paymentId,
    }).then(
      (value: any) => {
        applyLedger(value)
        return value
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not undo the settlement payment.'
        return null
      },
    ).finally(() => {
      saving.value = false
    })
  }

  return {
    addBillItem,
    addPersonToGroup,
    allBills,
    billItems,
    billPaidByPersonId,
    billPreviewShares,
    billRemainingCents,
    billTip,
    billTipCents,
    billTitle,
    billTotal,
    billTotalCents,
    canAddPersonToGroup,
    canCreateBill,
    createBill,
    createGroup,
    createPerson,
    deleteBill,
    ensureLoaded,
    errorMessage,
    formatCents,
    getBillById,
    getGroupById,
    groupName,
    health,
    homeSummary,
    ledger,
    ledgerLoaded,
    loadBillFormFromBill,
    peopleNotInSelectedGroup,
    personName,
    personToAddId,
    recentBillActivities,
    removeBillItem,
    recordSettlementPayment,
    resetBillForm,
    resultLayout,
    saving,
    selectedBill,
    selectedBillId,
    selectedGroup,
    selectedGroupBillTransfers,
    selectedGroupId,
    selectedGroupSettlementPayments,
    selectedGroupSimplifiedTotalCents,
    selectedGroupSimplifiedTransfers,
    setSelectedBill,
    setSelectedGroup,
    toggleBillItemAssignment,
    undoSettlementPayment,
    updateBill,
    updateBillItemAmount,
    updateBillItemName,
  }
}
