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
  <div class="surface-panel" style="padding: 18px;">
    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap;">
      <h3 class="h-ui" style="font-size: 18px; margin: 0;">
        Group settlement
      </h3>
      <span class="mono" style="font-size: 11px; color: var(--muted);">
        {{ transfers.length }} payments open · {{ formatCents(totalCents) }}
      </span>
    </div>

    <div style="font-size: 13px; line-height: 1.45; color: var(--muted); margin-top: 8px;">
      Bill transfers stay immutable. Settlement payments are recorded separately and the open group balance is recomputed from there.
    </div>

    <div v-if="transfers.length" style="display: grid; gap: 10px; margin-top: 14px;">
      <div
        v-for="transfer in transfers"
        :key="transfer.id"
        style="padding: 12px 14px; border-radius: 18px; background: var(--paper);"
      >
        <div style="display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
          <div>
            <div style="font-weight: 700; font-size: 14px;">
              {{ transfer.fromPerson.name }} owes {{ transfer.toPerson.name }}
            </div>
            <div class="mono" style="font-size: 12px; margin-top: 4px; color: var(--muted);">
              {{ formatCents(transfer.amountCents) }} still open
            </div>
          </div>

          <div class="mono" style="font-size: 11px; color: var(--muted);">
            simplified from {{ rawTransferCount }} raw transfers
          </div>
        </div>

        <form style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;" @submit.prevent="submitPayment(transfer)">
          <MoneyInput
            :model-value="paymentAmounts[transfer.id]"
            :disabled="saving"
            :input-style="{ flex: '1 1 120px', border: '1.5px solid rgba(20,18,16,0.12)', borderRadius: '14px', background: 'white', padding: '10px 12px', outline: 'none' }"
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

    <div v-else style="margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
      Nobody owes anyone anything in this group right now.
    </div>

    <div style="margin-top: 18px;">
      <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
        Settlement history
      </div>

      <div v-if="payments.length" style="display: grid; gap: 10px; margin-top: 12px;">
        <div
          v-for="payment in payments"
          :key="payment.id"
          style="padding: 12px 14px; border-radius: 18px; background: var(--paper);"
        >
          <div style="display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
            <div>
              <div style="font-weight: 700; font-size: 14px;">
                {{ payment.fromPerson.name }} paid {{ payment.toPerson.name }}
              </div>
              <div class="mono" style="font-size: 12px; margin-top: 4px; color: var(--muted);">
                {{ formatCents(payment.amountCents) }} · {{ formatTimestamp(payment.createdAt) }}
              </div>
            </div>

            <button
              v-if="!payment.isVoided"
              class="btn btn-ghost"
              style="padding: 8px 12px;"
              :disabled="saving"
              @click="emit('undo-payment', payment.id)"
            >
              Undo
            </button>

            <div
              v-else
              class="mono"
              style="font-size: 11px; color: var(--muted);"
            >
              Undone
            </div>
          </div>
        </div>
      </div>

      <div v-else style="margin-top: 12px; padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
        No settlement payments recorded yet.
      </div>
    </div>
  </div>
</template>
