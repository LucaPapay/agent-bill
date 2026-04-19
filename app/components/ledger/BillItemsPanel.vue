<script setup>
defineProps({
  bill: {
    type: Object,
    default: null,
  },
  formatCents: {
    type: Function,
    default: value => value,
  },
})
</script>

<template>
  <div class="surface-panel p-[18px]">
    <div class="section-label mb-3">
      Receipt items
    </div>

    <div v-if="bill?.items?.length" class="grid gap-2.5">
      <div
        v-for="item in bill.items"
        :key="item.id"
        class="rounded-[18px] bg-paper px-[14px] py-3"
      >
        <div class="flex justify-between gap-2.5">
          <div class="text-sm font-bold">
            {{ item.name }}
          </div>
          <div class="mono text-xs">
            {{ formatCents(item.amountCents) }}
          </div>
        </div>
        <div class="mt-1.5 text-xs leading-[1.45] text-muted">
          {{ item.assignedPeople.map(person => person.name).join(', ') || 'Unassigned' }}
        </div>
      </div>
    </div>

    <div v-else class="rounded-2xl bg-paper px-[14px] py-3 text-[13px]">
      This bill does not have saved receipt rows.
    </div>
  </div>
</template>
