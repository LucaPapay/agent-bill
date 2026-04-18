<script setup lang="ts">
const api = useOrpc()

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
const billSplits = ref<Array<{ itemAmount: string; personId: string }>>([])

const selectedGroup = computed(() =>
  ledger.value.groups.find((group: any) => group.id === selectedGroupId.value) || null
)

const selectedBill = computed(() =>
  selectedGroup.value?.bills.find((bill: any) => bill.id === selectedBillId.value) || null
)

const peopleNotInSelectedGroup = computed(() => {
  const memberIds = new Set((selectedGroup.value?.memberships || []).map((membership: any) => membership.personId))
  return ledger.value.people.filter((person: any) => !memberIds.has(person.id))
})

const billSubtotalCents = computed(() =>
  billSplits.value.reduce((sum: number, split) => sum + toCents(split.itemAmount), 0)
)

const billTipCents = computed(() => toCents(billTip.value))
const billTotalCents = computed(() => toCents(billTotal.value))
const billRemainingCents = computed(() => billTotalCents.value - billTipCents.value - billSubtotalCents.value)

watch(selectedGroup, (group) => {
  syncBillForm(group)
})

onMounted(() => {
  api.health().then((value) => {
    health.value = value
  })

  loadLedger()
})

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

function syncBillForm(group: any) {
  const members = group?.memberships || []
  const previousValues = new Map(
    billSplits.value.map(split => [split.personId, split.itemAmount]),
  )

  billSplits.value = members.map((membership: any) => ({
    itemAmount: previousValues.get(membership.personId) || '',
    personId: membership.personId,
  }))

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

function resetBillForm() {
  billTitle.value = 'Friday dinner'
  billTotal.value = '0'
  billTip.value = '0'
  syncBillForm(selectedGroup.value)
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

  api.createLedgerBill({
    groupId: selectedGroupId.value,
    paidByPersonId: billPaidByPersonId.value,
    splits: billSplits.value.map(split => ({
      itemAmountCents: toCents(split.itemAmount),
      personId: split.personId,
    })),
    tipAmountCents: billTipCents.value,
    title: billTitle.value,
    totalAmountCents: billTotalCents.value,
  }).then(
    (value: any) => {
      selectedBillId.value = value.billId
      applyLedger(value.ledger)
      resetBillForm()
    },
    (error: any) => {
      errorMessage.value = error?.message || 'Could not save the bill.'
    },
  ).finally(() => {
    saving.value = false
  })
}
</script>

<template>
  <main class="min-h-screen px-5 py-8 text-ink sm:px-8 lg:px-10">
    <div class="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section class="grid gap-6">
        <div class="rounded-[2rem] border border-white/60 bg-paper/85 p-6 card-shadow backdrop-blur sm:p-8">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="max-w-2xl">
              <p class="mb-3 inline-flex rounded-full border border-accent/25 bg-white/70 px-3 py-1 text-xs font-medium tracking-[0.22em] text-accent-deep uppercase">
                Manual split ledger
              </p>
              <h1 class="max-w-xl font-serif text-4xl leading-tight sm:text-5xl">
                Build groups, enter bills by hand, and keep the raw shares visible.
              </h1>
              <p class="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
                This flow stores local groups, group members, bills, per-person bill shares, and the
                derived who-owes-whom transfers that later simplification can work from.
              </p>
            </div>

            <div class="receipt-grid rounded-[1.75rem] border border-accent/15 bg-paper-strong/80 p-4 text-sm card-shadow">
              <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Status</p>
              <div class="mt-3 grid gap-2 text-sm">
                <div class="flex items-center justify-between gap-6">
                  <span>Groups</span>
                  <span class="rounded-full bg-white px-2 py-1 text-xs">{{ ledger.groups.length }}</span>
                </div>
                <div class="flex items-center justify-between gap-6">
                  <span>People</span>
                  <span class="rounded-full bg-white px-2 py-1 text-xs">{{ ledger.people.length }}</span>
                </div>
                <div class="flex items-center justify-between gap-6">
                  <span>Database</span>
                  <span class="rounded-full bg-white px-2 py-1 text-xs">
                    {{ health?.databaseConfigured ? 'ready' : 'missing url' }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-6">
                  <span>Pi</span>
                  <span class="rounded-full bg-white px-2 py-1 text-xs">
                    {{ health?.piReady ? 'optional' : 'off' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-8 grid gap-4 lg:grid-cols-2">
            <form class="grid gap-3 rounded-[1.75rem] border border-white/60 bg-white/80 p-5 card-shadow" @submit.prevent="createPerson">
              <div>
                <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Create person</p>
                <p class="mt-2 text-sm text-muted">
                  People are global so the same person can be added to multiple groups.
                </p>
              </div>

              <label class="grid gap-2 text-sm">
                <span>Name</span>
                <input
                  v-model="personName"
                  class="rounded-2xl border border-stone-200 bg-paper px-4 py-3 outline-none focus:border-accent"
                  placeholder="Jojo"
                >
              </label>

              <button
                class="rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="saving || !personName.trim()"
              >
                Create person
              </button>
            </form>

            <form class="grid gap-3 rounded-[1.75rem] border border-white/60 bg-white/80 p-5 card-shadow" @submit.prevent="createGroup">
              <div>
                <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Create group</p>
                <p class="mt-2 text-sm text-muted">
                  Groups own the bills. Members can belong to as many groups as you want.
                </p>
              </div>

              <label class="grid gap-2 text-sm">
                <span>Group name</span>
                <input
                  v-model="groupName"
                  class="rounded-2xl border border-stone-200 bg-paper px-4 py-3 outline-none focus:border-accent"
                  placeholder="Flat dinner club"
                >
              </label>

              <button
                class="rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="saving || !groupName.trim()"
              >
                Create group
              </button>
            </form>
          </div>

          <p v-if="errorMessage" class="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ errorMessage }}
          </p>
        </div>

        <div class="rounded-[2rem] border border-white/60 bg-white/85 p-6 card-shadow">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Groups</p>
              <h2 class="mt-2 font-serif text-3xl">Pick a working group</h2>
            </div>
          </div>

          <div v-if="ledger.groups.length" class="mt-5 grid gap-3">
            <button
              v-for="group in ledger.groups"
              :key="group.id"
              class="rounded-[1.5rem] border px-4 py-4 text-left transition"
              :class="group.id === selectedGroupId ? 'border-accent bg-paper' : 'border-stone-200 bg-white hover:border-accent/50'"
              @click="selectedGroupId = group.id"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-lg font-semibold">{{ group.name }}</p>
                  <p class="text-sm text-muted">
                    {{ group.memberships.length }} member{{ group.memberships.length === 1 ? '' : 's' }}
                    ·
                    {{ group.bills.length }} bill{{ group.bills.length === 1 ? '' : 's' }}
                  </p>
                </div>
                <span class="rounded-full bg-white px-3 py-1 text-xs text-muted">
                  {{ group.bills[0]?.title || 'No bills yet' }}
                </span>
              </div>
            </button>
          </div>

          <div
            v-else
            class="mt-5 rounded-[1.75rem] border border-dashed border-stone-300 bg-paper/70 px-5 py-8 text-sm leading-6 text-muted"
          >
            Start by creating a person and a group. Then add people into that group before entering bills.
          </div>
        </div>
      </section>

      <section class="grid gap-6">
        <div class="rounded-[2rem] border border-white/60 bg-white/85 p-6 card-shadow">
          <div v-if="selectedGroup" class="grid gap-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Selected group</p>
                <h2 class="mt-2 font-serif text-3xl">{{ selectedGroup.name }}</h2>
              </div>

              <form class="flex flex-wrap items-end gap-3" @submit.prevent="addPersonToGroup">
                <label class="grid gap-2 text-sm">
                  <span>Add existing person</span>
                  <select
                    v-model="personToAddId"
                    class="rounded-2xl border border-stone-200 bg-paper px-4 py-3 outline-none focus:border-accent"
                  >
                    <option value="">Select person</option>
                    <option v-for="person in peopleNotInSelectedGroup" :key="person.id" :value="person.id">
                      {{ person.name }}
                    </option>
                  </select>
                </label>

                <button
                  class="rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="saving || !personToAddId"
                >
                  Add to group
                </button>
              </form>
            </div>

            <div class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <div class="rounded-[1.75rem] border border-stone-200 bg-paper/80 p-5">
                <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Members</p>
                <div class="mt-4 grid gap-3">
                  <div
                    v-for="membership in selectedGroup.memberships"
                    :key="membership.id"
                    class="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm"
                  >
                    <span>{{ membership.person.name }}</span>
                    <span class="text-muted">ready for bills</span>
                  </div>
                </div>
              </div>

              <form class="grid gap-4 rounded-[1.75rem] border border-stone-200 bg-white p-5" @submit.prevent="createBill">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Create bill</p>
                    <p class="mt-2 text-sm text-muted">
                      Enter one food share per group member and one shared tip line. The bill creates raw shares and derived transfers.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="rounded-full border border-stone-200 px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-ink"
                    @click="resetBillForm"
                  >
                    Reset
                  </button>
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                  <label class="grid gap-2 text-sm">
                    <span>Bill title</span>
                    <input
                      v-model="billTitle"
                      class="rounded-2xl border border-stone-200 bg-paper px-4 py-3 outline-none focus:border-accent"
                      placeholder="Pizza night"
                    >
                  </label>

                  <label class="grid gap-2 text-sm">
                    <span>Paid by</span>
                    <select
                      v-model="billPaidByPersonId"
                      class="rounded-2xl border border-stone-200 bg-paper px-4 py-3 outline-none focus:border-accent"
                    >
                      <option value="">Select payer</option>
                      <option v-for="membership in selectedGroup.memberships" :key="membership.personId" :value="membership.personId">
                        {{ membership.person.name }}
                      </option>
                    </select>
                  </label>

                  <label class="grid gap-2 text-sm">
                    <span>Total amount</span>
                    <input
                      v-model="billTotal"
                      class="rounded-2xl border border-stone-200 bg-paper px-4 py-3 outline-none focus:border-accent"
                      placeholder="43.00"
                    >
                  </label>

                  <label class="grid gap-2 text-sm">
                    <span>Tip amount</span>
                    <input
                      v-model="billTip"
                      class="rounded-2xl border border-stone-200 bg-paper px-4 py-3 outline-none focus:border-accent"
                      placeholder="4.00"
                    >
                  </label>
                </div>

                <div class="rounded-[1.5rem] bg-paper p-4">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-xs font-medium tracking-[0.18em] text-muted uppercase">Food shares</p>
                    <p class="text-sm text-muted">Remaining: {{ formatCents(billRemainingCents) }}</p>
                  </div>

                  <div class="mt-4 grid gap-3">
                    <label
                      v-for="split in billSplits"
                      :key="split.personId"
                      class="grid gap-2 sm:grid-cols-[1fr_140px] sm:items-center"
                    >
                      <span class="text-sm">
                        {{ selectedGroup.memberships.find((membership: any) => membership.personId === split.personId)?.person.name }}
                      </span>
                      <input
                        v-model="split.itemAmount"
                        class="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-accent"
                        placeholder="0.00"
                      >
                    </label>
                  </div>
                </div>

                <button
                  class="rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="saving || !billTitle.trim() || !billPaidByPersonId || !selectedGroup.memberships.length"
                >
                  Save bill
                </button>
              </form>
            </div>
          </div>

          <div
            v-else
            class="rounded-[1.75rem] border border-dashed border-stone-300 bg-paper/70 px-5 py-8 text-sm leading-6 text-muted"
          >
            Pick a group to add members and create bills.
          </div>
        </div>

        <div v-if="selectedGroup" class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div class="rounded-[2rem] border border-white/60 bg-white/85 p-6 card-shadow">
            <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Bills</p>
            <div v-if="selectedGroup.bills.length" class="mt-4 grid gap-3">
              <button
                v-for="bill in selectedGroup.bills"
                :key="bill.id"
                class="rounded-[1.5rem] border px-4 py-4 text-left transition"
                :class="bill.id === selectedBillId ? 'border-accent bg-paper' : 'border-stone-200 bg-white hover:border-accent/50'"
                @click="selectedBillId = bill.id"
              >
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="font-semibold">{{ bill.title }}</p>
                    <p class="text-sm text-muted">
                      Paid by {{ bill.paidByPerson?.name || 'Unknown' }}
                    </p>
                  </div>
                  <span class="text-sm font-semibold">{{ formatCents(bill.totalAmountCents) }}</span>
                </div>
              </button>
            </div>

            <div
              v-else
              class="mt-4 rounded-[1.75rem] border border-dashed border-stone-300 bg-paper/70 px-5 py-8 text-sm leading-6 text-muted"
            >
              No bills have been saved for this group yet.
            </div>
          </div>

          <div class="rounded-[2rem] border border-white/60 bg-white/85 p-6 card-shadow">
            <div v-if="selectedBill" class="grid gap-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Bill detail</p>
                  <h3 class="mt-2 font-serif text-3xl">{{ selectedBill.title }}</h3>
                  <p class="mt-2 text-sm text-muted">
                    Paid by {{ selectedBill.paidByPerson?.name || 'Unknown' }}
                  </p>
                </div>

                <div class="text-right">
                  <p class="text-xs font-medium tracking-[0.18em] text-muted uppercase">Total</p>
                  <p class="mt-2 text-2xl font-semibold">{{ formatCents(selectedBill.totalAmountCents) }}</p>
                </div>
              </div>

              <div class="grid gap-4 sm:grid-cols-3">
                <div class="rounded-[1.5rem] bg-paper px-4 py-4">
                  <p class="text-xs font-medium tracking-[0.18em] text-muted uppercase">Tip</p>
                  <p class="mt-2 text-2xl font-semibold">{{ formatCents(selectedBill.tipAmountCents) }}</p>
                </div>
                <div class="rounded-[1.5rem] bg-paper px-4 py-4">
                  <p class="text-xs font-medium tracking-[0.18em] text-muted uppercase">People</p>
                  <p class="mt-2 text-2xl font-semibold">{{ selectedBill.shares.length }}</p>
                </div>
                <div class="rounded-[1.5rem] bg-paper px-4 py-4">
                  <p class="text-xs font-medium tracking-[0.18em] text-muted uppercase">Transfers</p>
                  <p class="mt-2 text-2xl font-semibold">{{ selectedBill.transfers.length }}</p>
                </div>
              </div>

              <div class="rounded-[1.75rem] border border-stone-200 bg-white p-5">
                <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Per-person shares</p>
                <div class="mt-4 grid gap-3">
                  <div
                    v-for="share in selectedBill.shares"
                    :key="share.id"
                    class="rounded-2xl bg-paper px-4 py-4"
                  >
                    <div class="flex items-center justify-between gap-4">
                      <span class="font-medium">{{ share.person.name }}</span>
                      <span class="text-lg font-semibold">{{ formatCents(share.totalAmountCents) }}</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-sm text-muted">
                      <div class="flex items-center justify-between gap-4">
                        <span>Food</span>
                        <span>{{ formatCents(share.itemAmountCents) }}</span>
                      </div>
                      <div class="flex items-center justify-between gap-4">
                        <span>Shared tip</span>
                        <span>{{ formatCents(share.tipAmountCents) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="rounded-[1.75rem] border border-stone-200 bg-white p-5">
                <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Derived transfers</p>
                <div v-if="selectedBill.transfers.length" class="mt-4 grid gap-3">
                  <div
                    v-for="transfer in selectedBill.transfers"
                    :key="transfer.id"
                    class="flex items-center justify-between gap-4 rounded-2xl bg-paper px-4 py-3 text-sm"
                  >
                    <span>{{ transfer.fromPerson.name }} owes {{ transfer.toPerson.name }}</span>
                    <span class="font-semibold">{{ formatCents(transfer.amountCents) }}</span>
                  </div>
                </div>
                <div
                  v-else
                  class="mt-4 rounded-2xl bg-paper px-4 py-4 text-sm text-muted"
                >
                  Nobody else owes money on this bill because the payer covered only their own share.
                </div>
              </div>
            </div>

            <div
              v-else
              class="rounded-[1.75rem] border border-dashed border-stone-300 bg-paper/70 px-5 py-8 text-sm leading-6 text-muted"
            >
              Pick a saved bill to inspect each person&apos;s food share, shared tip share, and the stored transfers.
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
