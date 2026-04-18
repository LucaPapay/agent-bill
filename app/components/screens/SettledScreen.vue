<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'

defineProps({
  formatCents: {
    type: Function,
    default: value => value,
  },
  selectedBill: {
    type: Object,
    default: null,
  },
  selectedBillId: {
    type: String,
    default: '',
  },
  selectedGroup: {
    type: Object,
    default: null,
  },
  selectedGroupBillTransfers: {
    type: Array,
    default: () => [],
  },
  selectedGroupSimplifiedTotalCents: {
    type: Number,
    default: 0,
  },
  selectedGroupSimplifiedTransfers: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['nav', 'select-bill'])
</script>

<template>
  <div class="screen" style="align-items: center; justify-content: flex-start; padding-top: 24px;">
    <div v-if="selectedGroup" class="section-pad" style="width: 100%; padding-bottom: 92px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span class="tape" style="background: var(--mint);">
          {{ selectedBill ? 'Bill saved' : 'Settlement view' }}
        </span>
      </div>

      <div v-if="selectedBill" class="receipt perforated-top perforated-bottom" style="padding: 28px 22px; margin: 0 6px; font-family: var(--mono);">
        <div style="text-align: center;">
          <div style="font-size: 10px; letter-spacing: 0.12em; color: var(--muted);">
            AGENT-BILL · {{ selectedGroup.name.toUpperCase() }}
          </div>
          <div class="h-display" style="font-size: 28px; margin: 8px 0 2px;">
            {{ selectedBill.title }}
          </div>
          <div style="font-size: 10px; letter-spacing: 0.08em; color: var(--muted);">
            {{ selectedBill.items.length }} ITEMS · {{ selectedBill.shares.length }} PEOPLE · PAID BY {{ selectedBill.paidByPerson?.name || 'UNKNOWN' }}
          </div>
        </div>

        <div style="border-top: 1.5px dashed var(--ink); margin: 16px 0;" />

        <div
          v-for="share in selectedBill.shares"
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
          <span>{{ formatCents(selectedBill.totalAmountCents) }}</span>
        </div>

        <div style="margin-top: 18px; text-align: center; font-size: 9px; letter-spacing: 0.15em; color: var(--muted);">
          RAW SHARES STORED · TRANSFERS DERIVED
        </div>
      </div>

      <div v-else class="surface-panel" style="padding: 20px; margin: 0 6px;">
        <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
          No bill selected
        </div>
        <div style="font-size: 15px; line-height: 1.5; margin-top: 8px;">
          Pick a bill below to inspect receipt items, member shares, and derived transfers.
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 24px;">
        <button class="btn btn-ghost" style="flex: 1;" @click="emit('nav', 'groups')">
          Back to groups
        </button>
        <button class="btn btn-primary" style="flex: 1;" @click="emit('nav', 'assign')">
          Create another bill
        </button>
      </div>

      <div style="display: grid; gap: 14px; margin-top: 18px;" class="home-main">
        <div class="surface-panel" style="padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap;">
            <h3 class="h-ui" style="font-size: 18px; margin: 0;">
              Group settlement
            </h3>
            <span class="mono" style="font-size: 11px; color: var(--muted);">
              {{ selectedGroupSimplifiedTransfers.length }} payments · {{ formatCents(selectedGroupSimplifiedTotalCents) }}
            </span>
          </div>

          <div v-if="selectedGroupSimplifiedTransfers.length" style="display: grid; gap: 10px; margin-top: 14px;">
            <div
              v-for="transfer in selectedGroupSimplifiedTransfers"
              :key="transfer.id"
              style="padding: 12px 14px; border-radius: 18px; background: var(--paper);"
            >
              <div style="font-weight: 700; font-size: 14px;">
                {{ transfer.fromPerson.name }} owes {{ transfer.toPerson.name }}
              </div>
              <div class="mono" style="font-size: 12px; margin-top: 4px; color: var(--muted);">
                {{ formatCents(transfer.amountCents) }} · simplified from {{ selectedGroupBillTransfers.length }} raw transfers
              </div>
            </div>
          </div>

          <div v-else style="margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
            Nobody owes anyone anything in this group right now.
          </div>
        </div>

        <div class="surface-panel" style="padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap;">
            <h3 class="h-ui" style="font-size: 18px; margin: 0;">
              Saved bills
            </h3>
            <span class="mono" style="font-size: 11px; color: var(--muted);">
              {{ selectedGroup.bills.length }} total
            </span>
          </div>

          <div v-if="selectedGroup.bills.length" style="display: grid; gap: 10px; margin-top: 14px;">
            <button
              v-for="bill in selectedGroup.bills"
              :key="bill.id"
              :style="{
                padding: '12px 14px',
                borderRadius: '18px',
                background: bill.id === selectedBillId ? 'var(--ink)' : 'var(--paper)',
                color: bill.id === selectedBillId ? 'var(--cream)' : 'var(--ink)',
                textAlign: 'left',
              }"
              @click="emit('select-bill', bill.id)"
            >
              <div style="font-weight: 700; font-size: 14px;">
                {{ bill.title }}
              </div>
              <div class="mono" style="font-size: 12px; margin-top: 4px; opacity: 0.7;">
                {{ formatCents(bill.totalAmountCents) }} · {{ bill.transfers.length }} bill transfers
              </div>
            </button>
          </div>
        </div>
      </div>

      <div v-if="selectedBill" style="display: grid; gap: 14px; margin-top: 18px;" class="profile-grid">
        <div class="surface-panel" style="padding: 18px;">
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">
            Receipt items
          </div>
          <div v-if="selectedBill.items.length" style="display: grid; gap: 10px;">
            <div
              v-for="item in selectedBill.items"
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

        <div class="surface-panel" style="padding: 18px;">
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">
            Derived transfers
          </div>
          <div v-if="selectedBill.transfers.length" style="display: grid; gap: 10px;">
            <div
              v-for="transfer in selectedBill.transfers"
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
      </div>
    </div>

    <div v-else class="section-pad" style="width: 100%; padding-top: 24px;">
      <div class="surface-panel" style="padding: 20px;">
        <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
          No group selected
        </div>
        <div style="font-size: 15px; line-height: 1.5; margin-top: 8px;">
          Pick a group before opening the settlement view.
        </div>
      </div>
    </div>
  </div>
</template>
