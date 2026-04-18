<script setup>
defineProps({
  formatCents: {
    type: Function,
    default: value => value,
  },
  rawTransferCount: {
    type: Number,
    default: 0,
  },
  totalCents: {
    type: Number,
    default: 0,
  },
  transfers: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <div class="surface-panel" style="padding: 18px;">
    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap;">
      <h3 class="h-ui" style="font-size: 18px; margin: 0;">
        Group settlement
      </h3>
      <span class="mono" style="font-size: 11px; color: var(--muted);">
        {{ transfers.length }} payments · {{ formatCents(totalCents) }}
      </span>
    </div>

    <div v-if="transfers.length" style="display: grid; gap: 10px; margin-top: 14px;">
      <div
        v-for="transfer in transfers"
        :key="transfer.id"
        style="padding: 12px 14px; border-radius: 18px; background: var(--paper);"
      >
        <div style="font-weight: 700; font-size: 14px;">
          {{ transfer.fromPerson.name }} owes {{ transfer.toPerson.name }}
        </div>
        <div class="mono" style="font-size: 12px; margin-top: 4px; color: var(--muted);">
          {{ formatCents(transfer.amountCents) }} · simplified from {{ rawTransferCount }} raw transfers
        </div>
      </div>
    </div>

    <div v-else style="margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
      Nobody owes anyone anything in this group right now.
    </div>
  </div>
</template>
