import { computed } from 'vue'
import { buildScanBillComposerDraft } from '../lib/scan-bill-draft'
import {
  buildPreviewShares,
  centsToMoneyInput,
  createEmptyBillItem,
  normalizeAssignedPersonIds,
  prepareBillItems,
  toCents,
  todayBillDate,
} from '../lib/ledger-bill-form'

let loadingPromise: Promise<void> | null = null

export function useLedgerState() {
  const api = useOrpc()
  const { clear, user } = useUserSession()

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
  const personToAddEmail = useState('ledger-state:person-to-add-email', () => '')

  const billTitle = useState('ledger-state:bill-title', () => 'Friday dinner')
  const billDate = useState('ledger-state:bill-date', () => todayBillDate())
  const billTotal = useState('ledger-state:bill-total', () => '0,00')
  const billTip = useState('ledger-state:bill-tip', () => '0,00')
  const billPaidByPersonId = useState('ledger-state:bill-paid-by-person-id', () => '')
  const billSourceChatId = useState('ledger-state:bill-source-chat-id', () => '')
  const billItems = useState<Array<{
    amount: string
    assignedPersonIds: string[]
    id: string
    name: string
  }>>('ledger-state:bill-items', () => [])
  const pendingBillComposerDraft = useState<any>('ledger-state:pending-bill-composer-draft', () => null)
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

  const billTipCents = computed(() => toCents(billTip.value))
  const billTotalCents = computed(() => toCents(billTotal.value))
  const preparedBillItems = computed(() =>
    prepareBillItems(selectedGroup.value, billItems.value),
  )
  const assignedBillItemsSubtotalCents = computed(() =>
    preparedBillItems.value.payloadItems.reduce((sum: number, item: any) => sum + item.amountCents, 0),
  )
  const billRemainingCents = computed(() =>
    billTotalCents.value - billTipCents.value - assignedBillItemsSubtotalCents.value,
  )

  const billPreviewShares = computed(() =>
    buildPreviewShares(
      selectedGroup.value,
      preparedBillItems.value.payloadItems,
      billTipCents.value,
      billTotalCents.value,
    ),
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

  const currentPersonId = computed(() => user.value?.personId || '')

  const homeGroupBalances = computed(() => {
    const personId = currentPersonId.value

    return ledger.value.groups
      .map((group: any) => {
        const outgoingCents = (group.simplifiedTransfers || []).reduce((sum: number, transfer: any) => {
          if (transfer.fromPersonId !== personId) {
            return sum
          }

          return sum + transfer.amountCents
        }, 0)

        const incomingCents = (group.simplifiedTransfers || []).reduce((sum: number, transfer: any) => {
          if (transfer.toPersonId !== personId) {
            return sum
          }

          return sum + transfer.amountCents
        }, 0)

        const paymentCount = (group.simplifiedTransfers || []).filter((transfer: any) =>
          transfer.fromPersonId === personId || transfer.toPersonId === personId,
        ).length
        const openCents = outgoingCents + incomingCents

        return {
          amountCents: outgoingCents || incomingCents,
          amountLabel: formatCents(outgoingCents || incomingCents),
          directionLabel: outgoingCents ? 'You owe' : incomingCents ? 'Owed to you' : 'Settled',
          groupId: group.id,
          groupName: group.name,
          helperLabel: paymentCount
            ? `${paymentCount} open ${paymentCount === 1 ? 'payment' : 'payments'}`
            : `${group.bills.length} saved ${group.bills.length === 1 ? 'bill' : 'bills'}`,
          incomingCents,
          outgoingCents,
          openCents,
          tone: outgoingCents ? 'tomato' : incomingCents ? 'mint' : 'muted',
        }
      })
      .sort((left: any, right: any) => {
        if (right.openCents !== left.openCents) {
          return right.openCents - left.openCents
        }

        return left.groupName.localeCompare(right.groupName)
      })
  })

  const totalYouOweCents = computed(() =>
    homeGroupBalances.value.reduce((sum: number, group: any) => sum + group.outgoingCents, 0),
  )

  const totalOwedToYouCents = computed(() =>
    homeGroupBalances.value.reduce((sum: number, group: any) => sum + group.incomingCents, 0),
  )

  const homeNetBalanceCents = computed(() =>
    totalOwedToYouCents.value - totalYouOweCents.value,
  )

  const totalBills = computed(() => allBills.value.length)

  const homeSummary = computed(() => ({
    dateLabel: new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    }).format(new Date()),
    groupBalances: homeGroupBalances.value,
    groupsCount: ledger.value.groups.length,
    incomingPayments: homeGroupBalances.value.reduce(
      (sum: number, group: any) => sum + (group.incomingCents ? 1 : 0),
      0,
    ),
    netBalanceLabel: formatCents(Math.abs(homeNetBalanceCents.value)),
    netBalanceTitle: homeNetBalanceCents.value > 0
      ? 'You are owed'
      : homeNetBalanceCents.value < 0
        ? 'You owe'
        : 'All settled',
    netBalanceTone: homeNetBalanceCents.value > 0 ? 'mint' : homeNetBalanceCents.value < 0 ? 'tomato' : 'muted',
    owedToYouLabel: formatCents(totalOwedToYouCents.value),
    peopleCount: ledger.value.people.length,
    totalBills: totalBills.value,
    youOweLabel: formatCents(totalYouOweCents.value),
    yourOpenGroupsCount: homeGroupBalances.value.reduce(
      (sum: number, group: any) => sum + (group.openCents ? 1 : 0),
      0,
    ),
    yourOutgoingPayments: homeGroupBalances.value.reduce(
      (sum: number, group: any) => sum + (group.outgoingCents ? 1 : 0),
      0,
    ),
  }))

  const canAddPersonToGroup = computed(() =>
    Boolean(selectedGroupId.value && personToAddEmail.value.trim()),
  )

  const canCreateBill = computed(() =>
    Boolean(
      selectedGroup.value
      && selectedGroup.value.memberships.length
      && billTitle.value.trim()
      && billPaidByPersonId.value
      && !preparedBillItems.value.hasIncompleteItems
      && billRemainingCents.value === 0
      && billTotalCents.value > 0,
    ),
  )

  function nextBillItemId() {
    billItemId.value += 1
    return `bill-item-${billItemId.value}`
  }

  function formatCents(cents: number) {
    return new Intl.NumberFormat('en-US', {
      currency: 'EUR',
      style: 'currency',
    }).format((cents || 0) / 100)
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
      billItems.value = [createEmptyBillItem(group, nextBillItemId)]
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
    billDate.value = todayBillDate()
    billTotal.value = '0,00'
    billTip.value = '0,00'
    billSourceChatId.value = ''
    billItems.value = []
    syncBillForm(selectedGroup.value)
  }

  function applyBillComposerDraft(groupId: string, draft: any) {
    if (!draft || draft.groupId !== groupId) {
      return false
    }

    setSelectedGroup(groupId)
    billTitle.value = draft.billTitle || 'Friday dinner'
    billDate.value = draft.billDate || todayBillDate()
    billTotal.value = draft.billTotal || '0,00'
    billTip.value = draft.billTip || '0,00'
    billSourceChatId.value = String(draft.sourceChatId || '').trim()
    billItems.value = Array.isArray(draft.billItems) && draft.billItems.length
      ? draft.billItems.map((item: any) => ({
          amount: item.amount || '',
          assignedPersonIds: [...(item.assignedPersonIds || [])],
          id: item.id || nextBillItemId(),
          name: item.name || '',
        }))
      : [createEmptyBillItem(selectedGroup.value, nextBillItemId)]
    billPaidByPersonId.value = draft.billPaidByPersonId || selectedGroup.value?.memberships?.[0]?.personId || ''
    syncBillForm(selectedGroup.value)
    return true
  }

  function loadBillFormFromBill(groupId: string, billId: string, options?: { duplicate?: boolean }) {
    const bill = getBillById(groupId, billId)

    if (!bill) {
      return false
    }

    setSelectedGroup(groupId)
    selectedBillId.value = bill.id
    billTitle.value = options?.duplicate ? `${bill.title} copy` : bill.title
    billDate.value = bill.billDate || todayBillDate()
    billTotal.value = centsToMoneyInput(bill.totalAmountCents || 0)
    billTip.value = centsToMoneyInput(bill.tipAmountCents || 0)
    billPaidByPersonId.value = bill.paidByPersonId
    billSourceChatId.value = options?.duplicate ? '' : String(bill.sourceChatId || '').trim()
    billItems.value = bill.items.length
      ? bill.items.map((item: any) => ({
          amount: centsToMoneyInput(item.amountCents || 0),
          assignedPersonIds: [...(item.assignedPersonIds || [])],
          id: nextBillItemId(),
          name: item.name,
        }))
      : [createEmptyBillItem(selectedGroup.value, nextBillItemId)]

    return true
  }

  function stageBillComposerDraft(draft: any) {
    pendingBillComposerDraft.value = draft
  }

  function consumeBillComposerDraft(groupId: string) {
    const draft = pendingBillComposerDraft.value

    if (!draft || draft.groupId !== groupId) {
      return false
    }

    pendingBillComposerDraft.value = null
    return applyBillComposerDraft(groupId, draft)
  }

  async function loadBillFormFromChat(groupId: string, chatId: string) {
    const group = getGroupById(groupId)
    const normalizedChatId = String(chatId || '').trim()

    if (!group || !normalizedChatId) {
      return false
    }

    return await api.getBillChat({
      chatId: normalizedChatId,
    }).then((result: any) => {
      const draftBundle = buildScanBillComposerDraft({
        chatId: normalizedChatId,
        group,
        receipt: result?.receipt,
        result,
      })

      if (!draftBundle) {
        return false
      }

      return applyBillComposerDraft(groupId, draftBundle.draft)
    }, () => false)
  }

  function addBillItem() {
    billItems.value.push(createEmptyBillItem(selectedGroup.value, nextBillItemId))
  }

  function removeBillItem(itemId: string) {
    billItems.value = billItems.value.filter(item => item.id !== itemId)

    if (!billItems.value.length) {
      billItems.value = [createEmptyBillItem(selectedGroup.value, nextBillItemId)]
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
      async (error: any) => {
        const message = String(error?.message || '').toLowerCase()

        if (error?.status === 401 || message.includes('unauthorized') || message.includes('sign in')) {
          await clear()
          resetState()
          await navigateTo('/login')
          return
        }

        errorMessage.value = error?.message || 'Could not load the local ledger.'
      },
    )
  }

  function resetState() {
    ledger.value = {
      groups: [],
      people: [],
    }
    health.value = null
    errorMessage.value = ''
    saving.value = false
    ledgerLoaded.value = false
    healthLoaded.value = false
    selectedGroupId.value = ''
    selectedBillId.value = ''
    pendingBillComposerDraft.value = null
    personName.value = ''
    groupName.value = ''
    personToAddEmail.value = ''
    billItemId.value = 0
    resetBillForm()
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
    if (!selectedGroupId.value || !personToAddEmail.value.trim()) {
      return Promise.resolve(null)
    }

    errorMessage.value = ''
    saving.value = true

    return api.addLedgerPersonToGroup({
      email: personToAddEmail.value,
      groupId: selectedGroupId.value,
    }).then(
      (value: any) => {
        personToAddEmail.value = ''
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

  function addCurrentUserToAllGroups() {
    errorMessage.value = ''
    saving.value = true

    return api.addLedgerPersonToAllGroups().then(
      (value: any) => {
        applyLedger(value)
        return value
      },
      (error: any) => {
        errorMessage.value = error?.message || 'Could not add you to every group.'
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

    return api.createLedgerBill({
      billDate: billDate.value,
      billItems: preparedBillItems.value.payloadItems,
      groupId: selectedGroupId.value,
      paidByPersonId: billPaidByPersonId.value,
      sourceChatId: billSourceChatId.value || undefined,
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

    return api.updateLedgerBill({
      billId,
      billDate: billDate.value,
      billItems: preparedBillItems.value.payloadItems,
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
    addCurrentUserToAllGroups,
    addPersonToGroup,
    allBills,
    billDate,
    billItems,
    billPaidByPersonId,
    billPreviewShares,
    billRemainingCents,
    billSourceChatId,
    billTip,
    billTipCents,
    billTitle,
    billTotal,
    billTotalCents,
    canAddPersonToGroup,
    canCreateBill,
    consumeBillComposerDraft,
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
    loadBillFormFromChat,
    personName,
    personToAddEmail,
    recentBillActivities,
    removeBillItem,
    recordSettlementPayment,
    resetState,
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
    stageBillComposerDraft,
    toggleBillItemAssignment,
    undoSettlementPayment,
    updateBill,
    updateBillItemAmount,
    updateBillItemName,
  }
}
