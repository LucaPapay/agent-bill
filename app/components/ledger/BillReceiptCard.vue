<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'

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
  bill: {
    type: Object,
    default: null,
  },
  formatCents: {
    type: Function,
    default: value => value,
  },
  group: {
    type: Object,
    default: null,
  },
})
</script>

<template>
  <div v-if="bill && group" class="receipt perforated-top perforated-bottom" style="padding: 28px 22px; margin: 0 6px; font-family: var(--mono);">
    <div style="text-align: center;">
      <div style="font-size: 10px; letter-spacing: 0.12em; color: var(--muted);">
        AGENT-BILL · {{ group.name.toUpperCase() }}
      </div>
      <div class="h-display" style="font-size: 28px; margin: 8px 0 2px;">
        {{ bill.title }}
      </div>
      <div style="font-size: 10px; letter-spacing: 0.08em; color: var(--muted);">
        {{ bill.items.length }} ITEMS · {{ bill.shares.length }} PEOPLE · PAID BY {{ bill.paidByPerson?.name || 'UNKNOWN' }}
      </div>
      <div v-if="bill.billDate" style="font-size: 10px; letter-spacing: 0.08em; color: var(--muted); margin-top: 4px;">
        {{ formatBillDate(bill.billDate) }}
      </div>
    </div>

    <div style="border-top: 1.5px dashed var(--ink); margin: 16px 0;" />

    <div
      v-for="share in bill.shares"
      :key="share.id"
      style="display: flex; align-items: center; gap: 10px; padding: 8px 0;"
    >
      <AvatarBadge :name="share.person.name" size="sm" />
      <div style="flex: 1; font-size: 13px; font-family: var(--ui); font-weight: 600;">
        {{ share.person.name }}
      </div>
      <div style="font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em;">
        {{ formatCents(share.itemAmountCents) }} + {{ formatCents(share.tipAmountCents) }}
      </div>
      <div class="mono" style="width: 72px; text-align: right; font-weight: 700; font-size: 13px;">
        {{ formatCents(share.totalAmountCents) }}
      </div>
    </div>

    <div style="border-top: 1.5px dashed var(--ink); margin: 12px 0 4px;" />
    <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 14px;">
      <span>TOTAL</span>
      <span>{{ formatCents(bill.totalAmountCents) }}</span>
    </div>

    <div style="margin-top: 18px; text-align: center; font-size: 9px; letter-spacing: 0.15em; color: var(--muted);">
      RAW SHARES STORED · TRANSFERS DERIVED
    </div>
  </div>
</template>
