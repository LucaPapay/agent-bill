<script setup>
import { computed } from 'vue'

const props = defineProps({
  receipt: {
    type: Object,
    required: true,
  },
  splitRows: {
    type: Array,
    default: () => [],
  },
  summary: {
    type: String,
    default: '',
  },
})

const resolvedCurrency = computed(() => String(props.receipt?.currency || 'EUR'))
const parsedItems = computed(() => Array.isArray(props.receipt?.items) ? props.receipt.items : [])
const parsedItemCount = computed(() => parsedItems.value.length)
const noteList = computed(() => Array.isArray(props.receipt?.notes) ? props.receipt.notes : [])
const billTimeLabel = computed(() => {
  const note = noteList.value.find(note => /^Bill time\b/i.test(note))
  return String(note || '').replace(/^Bill time\b/i, '').trim()
})
const vatLabel = computed(() => {
  const note = noteList.value.find(note => /^Contains\b.*\bVAT\b/i.test(note))
  return String(note || '').replace(/^Contains\b/i, '').trim()
})
const taxRowLabel = computed(() => (
  vatLabel.value ? `Tax (${vatLabel.value})` : 'Tax'
))
const hasVerifiedTotal = computed(() => (
  noteList.value.some(note => /^Total matches sum of subtotal and tax\.?$/i.test(note))
))
const visibleNotes = computed(() => noteList.value.filter((note) =>
  !/^Bill time\b/i.test(note)
  && !/^Contains\b.*\bVAT\b/i.test(note)
  && !/^Total matches sum of subtotal and tax\.?$/i.test(note),
))
const summaryText = computed(() => (
  String(props.summary || '').trim() || `Parsed ${parsedItemCount.value} bill items.`
))

function formatMoney(amountCents, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    currency,
    style: 'currency',
  }).format((amountCents || 0) / 100)
}
</script>

<template>
  <div class="w-[min(100%,720px)] rounded-3xl bg-[rgba(251,247,238,0.96)] p-[18px] text-[var(--ink)] shadow-[0_20px_38px_rgba(24,16,10,0.12)]">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="font-[var(--mono)] text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
          Parsed bill
        </div>
        <div class="mt-1.5 text-[22px] leading-[1.1] font-bold">
          {{ receipt.merchant || 'Untitled receipt' }}
        </div>
      </div>

      <div class="grid justify-items-end gap-1.5">
        <div class="font-[var(--mono)] text-xs text-[var(--muted)]">
          {{ formatMoney(receipt.totalCents || 0, resolvedCurrency) }}
        </div>
        <div
          v-if="billTimeLabel"
          class="font-[var(--mono)] text-[11px] uppercase tracking-[0.08em] text-[rgba(20,18,16,0.58)]"
        >
          Bill time {{ billTimeLabel }}
        </div>
      </div>
    </div>

    <div class="mt-3.5 text-sm leading-6 text-[rgba(20,18,16,0.72)]">
      {{ summaryText }}
    </div>

    <div v-if="splitRows.length" class="mt-4 grid gap-2.5 rounded-[18px] bg-[rgba(20,18,16,0.05)] p-3">
      <div
        v-for="row in splitRows"
        :key="row.person"
        class="flex justify-between gap-3 border-b border-[rgba(20,18,16,0.08)] pb-2.5 text-sm last:border-b-0 last:pb-0"
      >
        <span class="font-semibold">
          {{ row.person }}
        </span>
        <span>{{ formatMoney(row.amountCents || 0, resolvedCurrency) }}</span>
      </div>
    </div>

    <div v-else class="mt-4 grid gap-1.5 rounded-[18px] bg-[rgba(20,18,16,0.05)] p-3.5">
      <div class="text-[13px] font-bold uppercase tracking-[0.06em] text-[rgba(20,18,16,0.65)]">
        No split yet
      </div>
      <div class="text-sm leading-6 text-[var(--ink)]">
        Tell Penny who ate what so she can assign these items.
      </div>
      <div class="text-[13px] leading-6 text-[rgba(20,18,16,0.68)]">
        Example: “Tempura Bento was Luca. Sushi Bento was Penny. Cola was shared by everyone.”
      </div>
    </div>

    <div class="mt-4 grid gap-2.5">
      <div
        v-for="(item, index) in parsedItems"
        :key="`${item.name}-${index}`"
        class="flex justify-between gap-3 border-b border-[rgba(20,18,16,0.08)] pb-2.5 text-sm"
      >
        <span class="font-semibold">
          {{ item.quantity > 1 ? `${item.quantity} x ${item.name}` : item.name }}
        </span>
        <span>{{ formatMoney(item.amountCents || 0, resolvedCurrency) }}</span>
      </div>
    </div>

    <div class="mt-4 grid gap-2 border-t border-[rgba(20,18,16,0.1)] pt-3.5 text-[13px] text-[rgba(20,18,16,0.7)]">
      <div class="flex justify-between gap-3">
        <span>{{ taxRowLabel }}</span>
        <span>{{ formatMoney(receipt.taxCents || 0, resolvedCurrency) }}</span>
      </div>
      <div class="flex justify-between gap-3">
        <span>Tip</span>
        <span>{{ formatMoney(receipt.tipCents || 0, resolvedCurrency) }}</span>
      </div>
      <div class="flex justify-between gap-3 font-bold text-[var(--ink)]">
        <span class="inline-flex items-center gap-2">
          <span>Total</span>
          <span
            v-if="hasVerifiedTotal"
            class="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[rgba(143,197,106,0.18)] text-xs leading-none text-[#4d7f31]"
            aria-label="Total verified"
          >✓</span>
        </span>
        <span>{{ formatMoney(receipt.totalCents || 0, resolvedCurrency) }}</span>
      </div>
    </div>

    <div v-if="visibleNotes.length" class="mt-4 grid gap-2">
      <div
        v-for="note in visibleNotes"
        :key="note"
        class="rounded-2xl bg-[rgba(20,18,16,0.05)] px-3 py-2 text-[13px] leading-5 text-[rgba(20,18,16,0.68)]"
      >
        {{ note }}
      </div>
    </div>
  </div>
</template>
