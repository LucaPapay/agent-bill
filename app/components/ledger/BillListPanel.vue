<script setup>
function formatBillDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
}

defineProps({
  bills: {
    type: Array,
    default: () => [],
  },
  formatCents: {
    type: Function,
    default: value => value,
  },
  groupId: {
    type: String,
    required: true,
  },
  selectedBillId: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="surface-panel" style="padding: 18px;">
    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap;">
      <h3 class="h-ui" style="font-size: 18px; margin: 0;">
        Saved bills
      </h3>
      <span class="mono" style="font-size: 11px; color: var(--muted);">
        {{ bills.length }} total
      </span>
    </div>

    <div v-if="bills.length" style="display: grid; gap: 10px; margin-top: 14px;">
      <NuxtLink
        v-for="bill in bills"
        :key="bill.id"
        :to="`/groups/${groupId}/bills/${bill.id}`"
        :style="{
          padding: '12px 14px',
          borderRadius: '18px',
          background: bill.id === selectedBillId ? 'var(--ink)' : 'var(--paper)',
          color: bill.id === selectedBillId ? 'var(--cream)' : 'var(--ink)',
          textAlign: 'left',
          textDecoration: 'none',
        }"
      >
        <div style="font-weight: 700; font-size: 14px;">
          {{ bill.title }}
        </div>
        <div class="mono" style="font-size: 12px; margin-top: 4px; opacity: 0.7;">
          {{ formatBillDate(bill.billDate) || 'No date' }} · {{ formatCents(bill.totalAmountCents) }} · {{ bill.transfers.length }} bill transfers
        </div>
      </NuxtLink>
    </div>

    <div v-else style="margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
      No bills saved for this group yet.
    </div>
  </div>
</template>
