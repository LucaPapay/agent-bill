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
  visibleNotes: {
    type: Array,
    default: () => [],
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
  <div class="scan-receipt-card">
    <div class="scan-receipt-head">
      <div>
        <div class="scan-receipt-kicker">
          Parsed bill
        </div>
        <div class="scan-receipt-title">
          {{ receipt.merchant || 'Untitled receipt' }}
        </div>
      </div>

      <div class="scan-receipt-head-side">
        <div class="scan-receipt-total">
          {{ formatMoney(receipt.totalCents || 0, resolvedCurrency) }}
        </div>
        <div v-if="billTimeLabel" class="scan-receipt-time">
          Bill time {{ billTimeLabel }}
        </div>
      </div>
    </div>

    <div class="scan-receipt-summary">
      {{ summaryText }}
    </div>

    <div v-if="splitRows.length" class="scan-split-list">
      <div
        v-for="row in splitRows"
        :key="row.person"
        class="scan-item-row scan-split-row"
      >
        <span class="scan-item-name">
          {{ row.person }}
        </span>
        <span>{{ formatMoney(row.amountCents || 0, resolvedCurrency) }}</span>
      </div>
    </div>

    <div v-else class="scan-split-empty">
      <div class="scan-split-empty-title">
        No split yet
      </div>
      <div class="scan-split-empty-copy">
        Tell Penny who ate what so she can assign these items.
      </div>
      <div class="scan-split-empty-example">
        Example: “Tempura Bento was Luca. Sushi Bento was Penny. Cola was shared by everyone.”
      </div>
    </div>

    <div class="scan-receipt-items">
      <div
        v-for="(item, index) in parsedItems"
        :key="`${item.name}-${index}`"
        class="scan-item-row"
      >
        <span class="scan-item-name">
          {{ item.quantity > 1 ? `${item.quantity} x ${item.name}` : item.name }}
        </span>
        <span>{{ formatMoney(item.amountCents || 0, resolvedCurrency) }}</span>
      </div>
    </div>

    <div class="scan-receipt-totals">
      <div class="scan-mini-row">
        <span>{{ taxRowLabel }}</span>
        <span>{{ formatMoney(receipt.taxCents || 0, resolvedCurrency) }}</span>
      </div>
      <div class="scan-mini-row">
        <span>Tip</span>
        <span>{{ formatMoney(receipt.tipCents || 0, resolvedCurrency) }}</span>
      </div>
      <div class="scan-mini-row total">
        <span class="scan-total-label">
          <span>Total</span>
          <span v-if="hasVerifiedTotal" class="scan-total-check" aria-label="Total verified">✓</span>
        </span>
        <span>{{ formatMoney(receipt.totalCents || 0, resolvedCurrency) }}</span>
      </div>
    </div>

    <div v-if="visibleNotes.length" class="scan-receipt-notes">
      <div
        v-for="note in visibleNotes"
        :key="note"
        class="scan-note-row"
      >
        {{ note }}
      </div>
    </div>
  </div>
</template>
