<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import BottomTabBar from '../components/app/BottomTabBar.vue'
import AssignScreen from '../components/screens/AssignScreen.vue'
import ChatSplitScreen from '../components/screens/ChatSplitScreen.vue'
import GroupsScreen from '../components/screens/GroupsScreen.vue'
import HomeScreen from '../components/screens/HomeScreen.vue'
import ProfileScreen from '../components/screens/ProfileScreen.vue'
import ScanScreen from '../components/screens/ScanScreen.vue'
import SettledScreen from '../components/screens/SettledScreen.vue'

const api = useOrpc()

const screen = ref('home')
const resultLayout = ref('cards')

const ledger = ref<any>({
  groups: [],
  people: [],
})
const health = ref<any>(null)
const errorMessage = ref('')
const saving = ref(false)
const selectedBillId = ref('')
const selectedGroupId = ref('')

const personName = ref('')
const groupName = ref('')
const personToAddId = ref('')

const billTitle = ref('Friday dinner')
const billTotal = ref('0')
const billTip = ref('0')
const billPaidByPersonId = ref('')
const billItems = ref<Array<{
  amount: string
  assignedPersonIds: string[]
  id: string
  name: string
}>>([])

let billItemId = 0

const accentPalette = ['var(--tomato)', 'var(--marigold)', 'var(--mint)', 'var(--lilac)', 'var(--sky)']

const activeTab = computed(() => {
  if (['scan', 'chat', 'assign', 'settled'].includes(screen.value)) {
    return 'assign'
  }

  if (['home', 'groups', 'profile'].includes(screen.value)) {
    return screen.value
  }

  return ''
})

const selectedGroup = computed(() =>
  ledger.value.groups.find((group: any) => group.id === selectedGroupId.value) || null
)

const selectedBill = computed(() =>
  selectedGroup.value?.bills.find((bill: any) => bill.id === selectedBillId.value) || null
)

const selectedGroupBillTransfers = computed(() =>
  selectedGroup.value?.billTransfers || []
)

const selectedGroupSimplifiedTransfers = computed(() =>
  selectedGroup.value?.simplifiedTransfers || []
)

const selectedGroupSimplifiedTotalCents = computed(() =>
  selectedGroupSimplifiedTransfers.value.reduce((sum: number, transfer: any) => sum + transfer.amountCents, 0)
)

const selectedGroupMemberIds = computed(() =>
  (selectedGroup.value?.memberships || []).map((membership: any) => membership.personId)
)

const peopleNotInSelectedGroup = computed(() => {
  const memberIds = new Set(selectedGroupMemberIds.value)
  return ledger.value.people.filter((person: any) => !memberIds.has(person.id))
})

const billItemsSubtotalCents = computed(() =>
  billItems.value.reduce((sum: number, item) => sum + toCents(item.amount), 0)
)

const billTipCents = computed(() => toCents(billTip.value))
const billTotalCents = computed(() => toCents(billTotal.value))
const billRemainingCents = computed(() => billTotalCents.value - billTipCents.value - billItemsSubtotalCents.value)

const billPreviewShares = computed(() =>
  buildPreviewShares(selectedGroup.value, billItems.value, billTipCents.value, billTotalCents.value)
)

const allBills = computed(() =>
  ledger.value.groups.flatMap((group: any) =>
    group.bills.map((bill: any) => ({
      ...bill,
      groupId: group.id,
      groupName: group.name,
    })),
  )
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
  )
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
  Boolean(selectedGroupId.value && personToAddId.value)
)

const canCreateBill = computed(() =>
  Boolean(
    selectedGroup.value
    && selectedGroup.value.memberships.length
    && billTitle.value.trim()
    && billPaidByPersonId.value
    && billTotalCents.value > 0,
  )
)

watch(selectedGroup, (group) => {
  syncBillForm(group)
})

onMounted(() => {
  api.health().then((value) => {
    health.value = value
  })

  loadLedger()
})

function nextBillItemId() {
  billItemId += 1
  return `bill-item-${billItemId}`
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

function resetBillForm() {
  billTitle.value = 'Friday dinner'
  billTotal.value = '0'
  billTip.value = '0'
  billItems.value = []
  syncBillForm(selectedGroup.value)
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

function loadLedger() {
  api.getLedger().then(
    (value: any) => {
      applyLedger(value)
    },
    (error: any) => {
      errorMessage.value = error?.message || 'Could not load the local ledger.'
    },
  )
}

function createPerson() {
  errorMessage.value = ''
  saving.value = true

  api.createLedgerPerson({
    name: personName.value,
  }).then(
    (value: any) => {
      personName.value = ''
      applyLedger(value)
    },
    (error: any) => {
      errorMessage.value = error?.message || 'Could not create the person.'
    },
  ).finally(() => {
    saving.value = false
  })
}

function createGroup() {
  errorMessage.value = ''
  saving.value = true

  api.createLedgerGroup({
    name: groupName.value,
  }).then(
    (value: any) => {
      groupName.value = ''
      selectedGroupId.value = value.groupId
      applyLedger(value.ledger)
      screen.value = 'groups'
    },
    (error: any) => {
      errorMessage.value = error?.message || 'Could not create the group.'
    },
  ).finally(() => {
    saving.value = false
  })
}

function addPersonToGroup() {
  if (!selectedGroupId.value || !personToAddId.value) {
    return
  }

  errorMessage.value = ''
  saving.value = true

  api.addLedgerPersonToGroup({
    groupId: selectedGroupId.value,
    personId: personToAddId.value,
  }).then(
    (value: any) => {
      applyLedger(value)
    },
    (error: any) => {
      errorMessage.value = error?.message || 'Could not add the person to the group.'
    },
  ).finally(() => {
    saving.value = false
  })
}

function createBill() {
  if (!selectedGroupId.value) {
    return
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

  api.createLedgerBill({
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
      screen.value = 'settled'
    },
    (error: any) => {
      errorMessage.value = error?.message || 'Could not save the bill.'
    },
  ).finally(() => {
    saving.value = false
  })
}

function handleTabNav(nextScreen: string) {
  if (nextScreen === 'assign' && !selectedGroup.value) {
    screen.value = 'groups'
    return
  }

  screen.value = nextScreen
}

function openBill(groupId: string, billId: string) {
  selectedGroupId.value = groupId
  selectedBillId.value = billId
  screen.value = 'settled'
}
</script>

<template>
  <main class="app-root">
    <div class="app-view">
      <BottomTabBar :active-tab="activeTab" @nav="handleTabNav" />

      <HomeScreen
        v-if="screen === 'home'"
        :health="health"
        :recent-bills="recentBillActivities"
        :summary="homeSummary"
        @nav="handleTabNav"
        @open-bill="openBill($event.groupId, $event.billId)"
      />

      <GroupsScreen
        v-else-if="screen === 'groups'"
        :can-add-person-to-group="canAddPersonToGroup"
        :error-message="errorMessage"
        :format-cents="formatCents"
        :group-name="groupName"
        :groups="ledger.groups"
        :people-not-in-selected-group="peopleNotInSelectedGroup"
        :person-name="personName"
        :person-to-add-id="personToAddId"
        :saving="saving"
        :selected-group="selectedGroup"
        @add-person="addPersonToGroup"
        @open-assign="screen = 'assign'"
        @select-group="selectedGroupId = $event"
        @submit-group="createGroup"
        @submit-person="createPerson"
        @update:group-name="groupName = $event"
        @update:person-name="personName = $event"
        @update:person-to-add-id="personToAddId = $event"
      />

      <ProfileScreen
        v-else-if="screen === 'profile'"
        :health="health"
        :ledger="ledger"
      />

      <ScanScreen v-else-if="screen === 'scan'" @done="screen = 'chat'" />

      <ChatSplitScreen
        v-else-if="screen === 'chat'"
        @done="screen = selectedGroup ? 'assign' : 'groups'"
        @jump-to-items="screen = selectedGroup ? 'assign' : 'groups'"
      />

      <AssignScreen
        v-else-if="screen === 'assign'"
        :bill-items="billItems"
        :bill-paid-by-person-id="billPaidByPersonId"
        :bill-preview-shares="billPreviewShares"
        :bill-remaining-cents="billRemainingCents"
        :bill-tip="billTip"
        :bill-title="billTitle"
        :bill-total="billTotal"
        :can-create-bill="canCreateBill"
        :error-message="errorMessage"
        :format-cents="formatCents"
        :layout="resultLayout"
        :saving="saving"
        :selected-bill="selectedBill"
        :selected-group="selectedGroup"
        @add-item="addBillItem"
        @remove-item="removeBillItem"
        @reset="resetBillForm"
        @save="createBill"
        @toggle-assignment="toggleBillItemAssignment"
        @update:bill-paid-by-person-id="billPaidByPersonId = $event"
        @update:bill-tip="billTip = $event"
        @update:bill-title="billTitle = $event"
        @update:bill-total="billTotal = $event"
        @update:item-amount="updateBillItemAmount"
        @update:item-name="updateBillItemName"
        @update:layout="resultLayout = $event"
      />

      <SettledScreen
        v-else-if="screen === 'settled'"
        :format-cents="formatCents"
        :selected-bill="selectedBill"
        :selected-bill-id="selectedBillId"
        :selected-group="selectedGroup"
        :selected-group-bill-transfers="selectedGroupBillTransfers"
        :selected-group-simplified-total-cents="selectedGroupSimplifiedTotalCents"
        :selected-group-simplified-transfers="selectedGroupSimplifiedTransfers"
        @nav="handleTabNav"
        @select-bill="selectedBillId = $event"
      />

      <HomeScreen
        v-else
        :health="health"
        :recent-bills="recentBillActivities"
        :summary="homeSummary"
        @nav="handleTabNav"
        @open-bill="openBill($event.groupId, $event.billId)"
      />
    </div>
  </main>
</template>
