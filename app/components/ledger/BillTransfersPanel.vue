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
  <div class="surface-panel" style="padding: 18px;">
    <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">
      Derived transfers
    </div>

    <div style="font-size: 13px; line-height: 1.45; color: var(--muted); margin-bottom: 12px;">
      These rows show the original obligation created by this bill. Settlement payments are tracked separately at the group level.
    </div>

    <div v-if="bill?.transfers?.length" style="display: grid; gap: 10px;">
      <div
        v-for="transfer in bill.transfers"
        :key="transfer.id"
        style="padding: 12px 14px; border-radius: 18px; background: var(--paper);"
      >
        <div style="font-size: 14px; font-weight: 700;">
          {{ transfer.fromPerson.name }} owes {{ transfer.toPerson.name }}
        </div>
        <div class="mono" style="font-size: 12px; margin-top: 4px; color: var(--muted);">
          {{ formatCents(transfer.amountCents) }}
        </div>
      </div>
    </div>

    <div v-else style="padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
      The payer only covered their own share on this bill.
    </div>
  </div>
</template>
