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
  <div class="surface-panel p-[18px]">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h3 class="h-ui m-0 text-lg">
        Saved bills
      </h3>
      <span class="mono text-[11px] text-muted">
        {{ bills.length }} total
      </span>
    </div>

    <div v-if="bills.length" class="mt-[14px] grid gap-2.5">
      <NuxtLink
        v-for="bill in bills"
        :key="bill.id"
        :to="`/groups/${groupId}/bills/${bill.id}`"
        class="rounded-[18px] px-[14px] py-3 text-left no-underline"
        :class="bill.id === selectedBillId ? 'bg-ink text-cream' : 'bg-paper text-ink'"
      >
        <div class="text-sm font-bold">
          {{ bill.title }}
        </div>
        <div class="mono mt-1 text-xs opacity-70">
          {{ formatBillDate(bill.billDate) || 'No date' }} · {{ formatCents(bill.totalAmountCents) }} · {{ bill.transfers.length }} bill transfers
        </div>
      </NuxtLink>
    </div>

    <div v-else class="mt-[14px] rounded-2xl bg-paper px-[14px] py-3 text-[13px]">
      No bills saved for this group yet.
    </div>
  </div>
</template>
