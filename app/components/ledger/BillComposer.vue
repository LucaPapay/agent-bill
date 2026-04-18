<script setup>
import { ref } from 'vue'
import AvatarBadge from '../app/AvatarBadge.vue'
import IconGlyph from '../app/IconGlyph.vue'
import MoneyInput from '../app/MoneyInput.vue'

defineProps({
  billItems: {
    type: Array,
    default: () => [],
  },
  billPaidByPersonId: {
    type: String,
    default: '',
  },
  billDate: {
    type: String,
    default: '',
  },
  billPreviewShares: {
    type: Array,
    default: () => [],
  },
  billRemainingCents: {
    type: Number,
    default: 0,
  },
  billTip: {
    type: String,
    default: '',
  },
  billTitle: {
    type: String,
    default: '',
  },
  billTotal: {
    type: String,
    default: '',
  },
  canCreateBill: Boolean,
  embedded: Boolean,
  errorMessage: {
    type: String,
    default: '',
  },
  formatCents: {
    type: Function,
    default: value => value,
  },
  saving: Boolean,
  saveLabel: {
    type: String,
    default: 'Save bill',
  },
  selectedBill: {
    type: Object,
    default: null,
  },
  selectedGroup: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'add-item',
  'remove-item',
  'reset',
  'save',
  'toggle-assignment',
  'update:bill-paid-by-person-id',
  'update:bill-date',
  'update:bill-tip',
  'update:bill-title',
  'update:bill-total',
  'update:item-amount',
  'update:item-name',
])

const editingItems = ref(false)

function toCents(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[^0-9,.-]/g, '')
    .replace(',', '.')
  const amount = Number.parseFloat(normalized)

  if (!Number.isFinite(amount)) {
    return 0
  }

  return Math.max(0, Math.round(amount * 100))
}

function formatItemSummary(item, formatCents) {
  const assignedCount = item.assignedPersonIds.length || 0
  const itemCents = toCents(item.amount)

  if (assignedCount > 1) {
    return `${formatCents(itemCents)} total · ${formatCents(itemCents / assignedCount)} each · ${assignedCount} people assigned`
  }

  return `${item.amount || '0.00'} · ${assignedCount} people assigned`
}
</script>

<template>
  <div :class="embedded ? 'bill-composer' : 'screen bill-composer'">
    <div v-if="selectedGroup" class="section-pad" style="padding-top: 24px; padding-bottom: 18px;">
      <div>
        <span class="tape">Manual ledger</span>
        <h1 class="h-display" style="font-size: 36px; line-height: 1; margin: 8px 0 0;">
          {{ selectedGroup.name }}
        </h1>
        <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 4px;">
          {{ selectedGroup.memberships.length }} PEOPLE · {{ selectedGroup.bills.length }} SAVED BILLS
        </div>
      </div>
    </div>

    <div v-if="selectedGroup" class="section-pad assign-layout" style="padding-bottom: 96px;">
      <div class="assign-sidebar">
        <div class="assign-summary-stack">
          <div class="surface-panel" style="padding: 12px;">
            <div style="display: flex; gap: 8px; justify-content: space-between;">
              <div
                v-for="share in billPreviewShares"
                :key="share.personId"
                :style="{
                  flex: 1,
                  background: 'var(--paper)',
                  borderRadius: '16px',
                  padding: '10px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid rgba(20,18,16,0.1)',
                }"
              >
                <AvatarBadge :name="share.person.name" />
                <div style="font-size: 11px; font-weight: 600; text-align: center;">
                  {{ share.person.name }}
                </div>
                <div class="mono" style="font-size: 12px; font-weight: 700;">
                  {{ formatCents(share.totalAmountCents) }}
                </div>
              </div>
            </div>
          </div>

          <div style="background: var(--marigold); color: var(--ink); border-radius: 14px; padding: 10px 12px; display: flex; gap: 10px; align-items: flex-start; border: 1.5px solid var(--ink);">
            <IconGlyph name="sparkle" width="16" height="16" style="flex-shrink: 0; margin-top: 2px;" />
            <div style="font-size: 12px; line-height: 1.35;">
              <b>Penny:</b> Item assignments save the raw per-person bill shares first. Group settlement is derived after that, not instead of that.
            </div>
          </div>

          <div class="assign-remaining-bar">
            <div class="assign-remaining-copy">
              <span class="assign-remaining-label">Remaining</span>
              <span class="assign-remaining-amount">{{ formatCents(billRemainingCents) }}</span>
              <span class="assign-remaining-note">Items + tip must equal the bill total</span>
            </div>

            <div class="assign-remaining-actions">
              <button class="btn btn-accent assign-inline-button" :disabled="saving || !canCreateBill" @click="emit('save')">
                {{ saveLabel }}
                <IconGlyph name="chevron" width="16" height="16" />
              </button>
              <button class="btn btn-ghost assign-inline-button" @click="emit('reset')">
                Reset form
              </button>
            </div>
          </div>
        </div>

        <div v-if="errorMessage" style="padding: 12px 14px; border-radius: 16px; background: #fff0ec; color: #7d2f21; border: 1px solid rgba(255,84,54,0.2); font-size: 13px;">
          {{ errorMessage }}
        </div>

        <div v-if="selectedBill" class="surface-panel" style="padding: 14px;">
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
            Latest saved bill
          </div>
          <div style="font-size: 15px; font-weight: 700; margin-top: 8px;">
            {{ selectedBill.title }}
          </div>
          <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 4px;">
            {{ formatCents(selectedBill.totalAmountCents) }} · {{ selectedBill.items.length }} ITEMS
          </div>
        </div>
      </div>

      <div class="assign-items-card">
        <div class="surface-panel" style="padding: 16px 16px 18px;">
          <div style="display: grid; gap: 12px; margin-bottom: 16px;" class="profile-grid">
            <label style="display: grid; gap: 6px;">
              <span class="mono" style="font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">Bill title</span>
              <input
                :value="billTitle"
                type="text"
                placeholder="Friday dinner"
                style="width: 100%; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
                @input="emit('update:bill-title', $event.target.value)"
              >
            </label>

            <label style="display: grid; gap: 6px;">
              <span class="mono" style="font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">Date</span>
              <input
                :value="billDate"
                type="date"
                style="width: 100%; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
                @input="emit('update:bill-date', $event.target.value)"
              >
            </label>

            <label style="display: grid; gap: 6px;">
              <span class="mono" style="font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">Paid by</span>
              <select
                :value="billPaidByPersonId"
                style="width: 100%; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
                @change="emit('update:bill-paid-by-person-id', $event.target.value)"
              >
                <option value="">
                  Select payer
                </option>
                <option
                  v-for="membership in selectedGroup.memberships"
                  :key="membership.personId"
                  :value="membership.personId"
                >
                  {{ membership.person.name }}
                </option>
              </select>
            </label>

            <label style="display: grid; gap: 6px;">
              <span class="mono" style="font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">Total</span>
              <MoneyInput
                :model-value="billTotal"
                placeholder="43,00€"
                :input-style="{ width: '100%', border: '1.5px solid rgba(20,18,16,0.12)', borderRadius: '16px', background: 'var(--paper)', padding: '12px 14px', outline: 'none' }"
                @update:model-value="emit('update:bill-total', $event)"
              />
            </label>

            <label style="display: grid; gap: 6px;">
              <span class="mono" style="font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">Tip</span>
              <MoneyInput
                :model-value="billTip"
                placeholder="4,00€"
                :input-style="{ width: '100%', border: '1.5px solid rgba(20,18,16,0.12)', borderRadius: '16px', background: 'var(--paper)', padding: '12px 14px', outline: 'none' }"
                @update:model-value="emit('update:bill-tip', $event)"
              />
            </label>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
            <div>
              <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
                Receipt items
              </div>
              <div style="font-size: 14px; line-height: 1.45; margin-top: 4px;">
                {{
                  editingItems
                    ? 'Fix the parsed item names or amounts here. Assignments stay in walkthrough mode so the list still fits on mobile.'
                    : 'Walk through the parsed items and tap who shared each one. If an item is wrong, switch to edit mode first.'
                }}
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button
                v-if="editingItems"
                class="btn btn-primary"
                style="padding: 10px 16px;"
                @click="emit('add-item')"
              >
                Add item
              </button>
              <button
                class="btn"
                :class="editingItems ? 'btn-accent' : 'btn-ghost'"
                style="padding: 10px 16px;"
                @click="editingItems = !editingItems"
              >
                {{ editingItems ? 'Done editing items' : 'Edit items' }}
              </button>
            </div>
          </div>

          <div v-if="editingItems" style="display: grid; gap: 10px;">
            <div
              v-for="item in billItems"
              :key="`${item.id}:edit`"
              class="surface-panel"
              style="padding: 14px;"
            >
              <div class="composer-edit-row">
                <label style="display: grid; gap: 6px;">
                  <span class="mono" style="font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">Item</span>
                  <input
                    :value="item.name"
                    type="text"
                    placeholder="Margherita pizza"
                    style="width: 100%; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
                    @input="emit('update:item-name', item.id, $event.target.value)"
                  >
                </label>

                <label style="display: grid; gap: 6px;">
                  <span class="mono" style="font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">Price</span>
                  <MoneyInput
                    :model-value="item.amount"
                    allow-empty
                    placeholder="12,50€"
                    :input-style="{ width: '100%', border: '1.5px solid rgba(20,18,16,0.12)', borderRadius: '16px', background: 'var(--paper)', padding: '12px 14px', outline: 'none' }"
                    @update:model-value="emit('update:item-amount', item.id, $event)"
                  />
                </label>
              </div>

              <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                <button
                  class="btn btn-ghost"
                  style="padding: 10px 14px;"
                  @click="emit('remove-item', item.id)"
                >
                  Remove item
                </button>
              </div>
            </div>
          </div>

          <div v-else style="display: grid; gap: 12px;">
            <div
              v-for="item in billItems"
              :key="`${item.id}:walkthrough`"
              style="padding: 14px; border-radius: 18px; background: var(--paper);"
            >
              <div style="font-size: 16px; font-weight: 700; margin-top: 6px;">
                {{ item.name || 'Untitled item' }}
              </div>
              <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">
                {{ formatItemSummary(item, formatCents) }}
              </div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px;">
                <button
                  v-for="membership in selectedGroup.memberships"
                  :key="`${item.id}:walkthrough:${membership.personId}`"
                  class="chip"
                  :style="{
                    background: item.assignedPersonIds.includes(membership.personId) ? 'var(--ink)' : 'rgba(20,18,16,0.08)',
                    color: item.assignedPersonIds.includes(membership.personId) ? 'var(--cream)' : 'var(--ink)',
                  }"
                  @click="emit('toggle-assignment', item.id, membership.personId)"
                >
                  {{ membership.person.name }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="section-pad" style="padding-top: 24px;">
      <div class="surface-panel" style="padding: 20px;">
        <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
          No group selected
        </div>
        <div style="font-size: 15px; line-height: 1.5; margin-top: 8px;">
          Pick a group before opening the bill composer.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer-edit-row {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) minmax(110px, 180px);
}

@media (max-width: 720px) {
  .composer-edit-row {
    grid-template-columns: 1fr;
  }
}
</style>
