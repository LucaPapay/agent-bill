<script setup lang="ts">
import type { PropType } from 'vue'
import { reactive, watch } from 'vue'
import MoneyInput from '../app/MoneyInput.vue'

type Person = {
  name: string
}

type SettlementTransfer = {
  amountCents: number
  fromPerson: Person
  fromPersonId: string
  id: string
  toPerson: Person
  toPersonId: string
}

type SettlementPayment = {
  amountCents: number
  createdAt: string
  fromPerson: Person
  id: string
  isVoided: boolean
  toPerson: Person
}

const props = defineProps({
  formatCents: {
    type: Function as PropType<(value: number) => string>,
    default: (value: number) => String(value),
  },
  payments: {
    type: Array as PropType<SettlementPayment[]>,
    default: () => [],
  },
  rawTransferCount: {
    type: Number,
    default: 0,
  },
  saving: Boolean,
  totalCents: {
    type: Number,
    default: 0,
  },
  transfers: {
    type: Array as PropType<SettlementTransfer[]>,
    default: () => [],
  },
})

const emit = defineEmits(['record-payment', 'undo-payment'])

const paymentAmounts = reactive<Record<string, string>>({})

watch(() => props.transfers, (transfers) => {
  for (const key of Object.keys(paymentAmounts)) {
    if (!transfers.find(transfer => transfer.id === key)) {
      delete paymentAmounts[key]
    }
  }

  for (const transfer of transfers) {
    paymentAmounts[transfer.id] = centsToInput(transfer.amountCents)
  }
}, { deep: true, immediate: true })

function centsToInput(cents: number) {
  return ((cents || 0) / 100).toFixed(2).replace('.', ',')
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

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

function submitPayment(transfer: SettlementTransfer) {
  const amountCents = toCents(paymentAmounts[transfer.id])

  if (!amountCents) {
    return
  }

  emit('record-payment', {
    amountCents,
    fromPersonId: transfer.fromPersonId,
    toPersonId: transfer.toPersonId,
  })
}
</script>

<template>
  <div class="surface-panel p-[18px]">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h3 class="h-ui m-0 text-lg">
        Group settlement
      </h3>
      <span class="mono text-[11px] text-muted">
        {{ transfers.length }} payments open · {{ formatCents(totalCents) }}
      </span>
    </div>

    <div class="mt-2 text-[13px] leading-[1.45] text-muted">
      Bill transfers stay immutable. Settlement payments are recorded separately and the open group balance is recomputed from there.
    </div>

    <div v-if="transfers.length" class="mt-[14px] grid gap-2.5">
      <div
        v-for="transfer in transfers"
        :key="transfer.id"
        class="rounded-[18px] bg-paper px-[14px] py-3"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm font-bold">
              {{ transfer.fromPerson.name }} owes {{ transfer.toPerson.name }}
            </div>
            <div class="mono mt-1 text-xs text-muted">
              {{ formatCents(transfer.amountCents) }} still open
            </div>
          </div>

          <div class="mono text-[11px] text-muted">
            simplified from {{ rawTransferCount }} raw transfers
          </div>
        </div>

        <form class="mt-3 flex flex-wrap gap-2" @submit.prevent="submitPayment(transfer)">
          <MoneyInput
            class="min-w-[120px] flex-[1_1_120px] rounded-[14px] border-[1.5px] border-black/12 bg-white px-3 py-2.5 outline-none"
            :model-value="paymentAmounts[transfer.id]"
            :disabled="saving"
            @update:model-value="paymentAmounts[transfer.id] = $event"
          />

          <button class="btn btn-primary" :disabled="saving || !paymentAmounts[transfer.id]?.trim()">
            Record payment
          </button>

          <button
            type="button"
            class="btn btn-ghost"
            :disabled="saving"
            @click="paymentAmounts[transfer.id] = centsToInput(transfer.amountCents)"
          >
            Full amount
          </button>
        </form>
      </div>
    </div>

    <div v-else class="mt-[14px] rounded-2xl bg-paper px-[14px] py-3 text-[13px]">
      Nobody owes anyone anything in this group right now.
    </div>

    <div class="mt-[18px]">
      <div class="section-label">
        Settlement history
      </div>

      <div v-if="payments.length" class="mt-3 grid gap-2.5">
        <div
          v-for="payment in payments"
          :key="payment.id"
          class="rounded-[18px] bg-paper px-[14px] py-3"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-sm font-bold">
                {{ payment.fromPerson.name }} paid {{ payment.toPerson.name }}
              </div>
              <div class="mono mt-1 text-xs text-muted">
                {{ formatCents(payment.amountCents) }} · {{ formatTimestamp(payment.createdAt) }}
              </div>
            </div>

            <button
              v-if="!payment.isVoided"
              class="btn btn-ghost"
              :class="'px-3 py-2 text-[13px]'"
              :disabled="saving"
              @click="emit('undo-payment', payment.id)"
            >
              Undo
            </button>

            <div
              v-else
              class="mono text-[11px] text-muted"
            >
              Undone
            </div>
          </div>
        </div>
      </div>

      <div v-else class="mt-3 rounded-2xl bg-paper px-[14px] py-3 text-[13px]">
        No settlement payments recorded yet.
      </div>
    </div>
  </div>
</template>
