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
      Derived transfers
    </div>

    <div class="mb-3 text-[13px] leading-[1.45] text-muted">
      These rows show the original obligation created by this bill. Settlement payments are tracked separately at the group level.
    </div>

    <div v-if="bill?.transfers?.length" class="grid gap-2.5">
      <div
        v-for="transfer in bill.transfers"
        :key="transfer.id"
        class="rounded-[18px] bg-paper px-[14px] py-3"
      >
        <div class="text-sm font-bold">
          {{ transfer.fromPerson.name }} owes {{ transfer.toPerson.name }}
        </div>
        <div class="mono mt-1 text-xs text-muted">
          {{ formatCents(transfer.amountCents) }}
        </div>
      </div>
    </div>

    <div v-else class="rounded-2xl bg-paper px-[14px] py-3 text-[13px]">
      The payer only covered their own share on this bill.
    </div>
  </div>
</template>
