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
  <div
    v-if="bill && group"
    class="receipt perforated-top perforated-bottom mx-auto w-full max-w-[960px] px-[22px] py-7 font-mono"
  >
    <div class="text-center">
      <div class="text-[10px] tracking-[0.12em] text-muted">
        AGENT-BILL · {{ group.name.toUpperCase() }}
      </div>
      <div class="h-display my-2 text-[28px]">
        {{ bill.title }}
      </div>
      <div class="text-[10px] tracking-[0.08em] text-muted">
        {{ bill.items.length }} ITEMS · {{ bill.shares.length }} PEOPLE · PAID BY {{ bill.paidByPerson?.name || 'UNKNOWN' }}
      </div>
      <div v-if="bill.billDate" class="mt-1 text-[10px] tracking-[0.08em] text-muted">
        {{ formatBillDate(bill.billDate) }}
      </div>
    </div>

    <div class="my-4 border-t-[1.5px] border-dashed border-ink" />

    <div
      v-for="share in bill.shares"
      :key="share.id"
      class="flex items-center gap-2.5 py-2"
    >
      <AvatarBadge :name="share.person.name" size="sm" />
      <div class="flex-1 font-ui text-[13px] font-semibold">
        {{ share.person.name }}
      </div>
      <div class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
        {{ formatCents(share.itemAmountCents) }} + {{ formatCents(share.tipAmountCents) }}
      </div>
      <div class="mono w-[72px] text-right text-[13px] font-bold">
        {{ formatCents(share.totalAmountCents) }}
      </div>
    </div>

    <div class="mb-1 mt-3 border-t-[1.5px] border-dashed border-ink" />
    <div class="flex justify-between text-sm font-bold">
      <span>TOTAL</span>
      <span>{{ formatCents(bill.totalAmountCents) }}</span>
    </div>

    <div class="mt-[18px] text-center text-[9px] tracking-[0.15em] text-muted">
      RAW SHARES STORED · TRANSFERS DERIVED
    </div>
  </div>
</template>
