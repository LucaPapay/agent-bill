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
      Receipt items
    </div>

    <div v-if="bill?.items?.length" style="display: grid; gap: 10px;">
      <div
        v-for="item in bill.items"
        :key="item.id"
        style="padding: 12px 14px; border-radius: 18px; background: var(--paper);"
      >
        <div style="display: flex; justify-content: space-between; gap: 10px;">
          <div style="font-weight: 700; font-size: 14px;">
            {{ item.name }}
          </div>
          <div class="mono" style="font-size: 12px;">
            {{ formatCents(item.amountCents) }}
          </div>
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-top: 6px; line-height: 1.45;">
          {{ item.assignedPeople.map(person => person.name).join(', ') || 'Unassigned' }}
        </div>
      </div>
    </div>

    <div v-else style="padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
      This bill does not have saved receipt rows.
    </div>
  </div>
</template>
