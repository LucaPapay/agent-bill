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
    <div v-if="selectedGroup" class="section-pad pb-[18px] pt-6">
      <div>
        <span class="tape">Manual ledger</span>
        <h1 class="h-display mt-2 text-[36px] leading-none">
          {{ selectedGroup.name }}
        </h1>
        <div class="mono mt-1 text-[11px] text-muted">
          {{ selectedGroup.memberships.length }} PEOPLE · {{ selectedGroup.bills.length }} SAVED BILLS
        </div>
      </div>
    </div>

    <div v-if="selectedGroup" class="section-pad assign-layout pb-24">
      <div class="bill-composer-summary-rail">
        <div class="assign-summary-stack">
          <div class="surface-panel p-3">
            <div class="flex justify-between gap-2">
              <div
                v-for="share in billPreviewShares"
                :key="share.personId"
                class="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-black/10 bg-paper px-1.5 py-2.5"
              >
                <AvatarBadge :name="share.person.name" />
                <div class="text-center text-[11px] font-semibold">
                  {{ share.person.name }}
                </div>
                <div class="mono text-xs font-bold">
                  {{ formatCents(share.totalAmountCents) }}
                </div>
              </div>
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
            </div>
          </div>
        </div>
      </div>

      <div v-if="errorMessage || selectedBill" class="assign-sidebar">
        <div v-if="errorMessage" class="callout-error">
          {{ errorMessage }}
        </div>

      </div>

      <div class="assign-items-card">
        <div class="surface-panel px-4 pb-[18px] pt-4">
          <div class="profile-grid mb-4 grid gap-3">
            <label class="grid gap-1.5">
              <span class="field-label">Bill title</span>
              <input
                :value="billTitle"
                type="text"
                placeholder="Friday dinner"
                class="form-input"
                @input="emit('update:bill-title', $event.target.value)"
              >
            </label>

            <label class="grid gap-1.5">
              <span class="field-label">Date</span>
              <input
                :value="billDate"
                type="date"
                class="form-input"
                @input="emit('update:bill-date', $event.target.value)"
              >
            </label>

            <label class="grid gap-1.5">
              <span class="field-label">Paid by</span>
              <select
                :value="billPaidByPersonId"
                class="form-input"
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

            <label class="grid gap-1.5">
              <span class="field-label">Total</span>
              <MoneyInput
                class="form-input"
                :model-value="billTotal"
                placeholder="43,00€"
                @update:model-value="emit('update:bill-total', $event)"
              />
            </label>

            <label class="grid gap-1.5">
              <span class="field-label">Tip</span>
              <MoneyInput
                class="form-input"
                :model-value="billTip"
                placeholder="4,00€"
                @update:model-value="emit('update:bill-tip', $event)"
              />
            </label>
          </div>

          <div class="receipt-items-header">
            <div class="receipt-items-copy">
              <div class="section-label">
                Receipt items
              </div>
              <div v-if="editingItems" class="mt-1 text-sm leading-[1.45]">
                Fix the parsed item names or amounts here. Assignments stay in walkthrough mode so the list still fits on mobile.
              </div>
            </div>

            <div class="receipt-items-actions">
              <button
                v-if="editingItems"
                class="btn btn-primary btn-sm"
                @click="emit('add-item')"
              >
                Add item
              </button>
              <button
                class="btn"
                :class="['btn-sm', editingItems ? 'btn-accent' : 'btn-ghost']"
                @click="editingItems = !editingItems"
              >
                {{ editingItems ? 'Done editing items' : 'Edit items' }}
              </button>
            </div>
          </div>

          <div v-if="editingItems" class="grid gap-2.5">
            <div
              v-for="item in billItems"
              :key="`${item.id}:edit`"
              class="surface-panel p-[14px]"
            >
              <div class="composer-edit-row">
                <label class="grid gap-1.5">
                  <span class="field-label">Item</span>
                  <input
                    :value="item.name"
                    type="text"
                    placeholder="Margherita pizza"
                    class="form-input"
                    @input="emit('update:item-name', item.id, $event.target.value)"
                  >
                </label>

                <label class="grid gap-1.5">
                  <span class="field-label">Price</span>
                  <MoneyInput
                    class="form-input"
                    :model-value="item.amount"
                    allow-empty
                    placeholder="12,50€"
                    @update:model-value="emit('update:item-amount', item.id, $event)"
                  />
                </label>
              </div>

              <div class="mt-3 flex justify-end">
                <button
                  class="btn btn-ghost px-[14px] py-2.5 text-[13px]"
                  @click="emit('remove-item', item.id)"
                >
                  Remove item
                </button>
              </div>
            </div>
          </div>

          <div v-else class="grid gap-3">
            <div
              v-for="item in billItems"
              :key="`${item.id}:walkthrough`"
              class="rounded-[18px] bg-paper px-[14px] pb-[14px] pt-2.5"
            >
              <div class="text-base font-bold">
                {{ item.name || 'Untitled item' }}
              </div>
              <div class="mt-0.5 text-[13px] text-muted">
                {{ formatItemSummary(item, formatCents) }}
              </div>
              <div class="mt-2.5 flex flex-wrap gap-1.5">
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

    <div v-else class="section-pad pt-6">
      <div class="surface-panel p-5">
        <div class="section-label">
          No group selected
        </div>
        <div class="mt-2 text-[15px] leading-[1.5]">
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

.receipt-items-header {
  margin-bottom: 6px;
  position: relative;
}

.receipt-items-copy {
  padding-right: 180px;
}

.receipt-items-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  position: absolute;
  right: 0;
  top: 0;
}

.bill-composer-summary-rail {
  display: grid;
}

@media (min-width: 900px) {
  .bill-composer {
    overflow: visible;
  }

  .bill-composer-summary-rail {
    align-self: start;
    position: sticky;
    top: 96px;
    z-index: 6;
  }

  .bill-composer-summary-rail .assign-summary-stack {
    position: static;
  }
}

@media (max-width: 720px) {
  .composer-edit-row {
    grid-template-columns: 1fr;
  }

  .receipt-items-copy {
    padding-right: 0;
  }

  .receipt-items-actions {
    margin-top: 8px;
    position: static;
  }
}
</style>
