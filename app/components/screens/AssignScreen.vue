<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'
import IconGlyph from '../app/IconGlyph.vue'

defineProps({
  billItems: {
    type: Array,
    default: () => [],
  },
  billPaidByPersonId: {
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
  errorMessage: {
    type: String,
    default: '',
  },
  formatCents: {
    type: Function,
    default: value => value,
  },
  layout: {
    type: String,
    default: 'cards',
  },
  saving: Boolean,
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
  'update:bill-tip',
  'update:bill-title',
  'update:bill-total',
  'update:item-amount',
  'update:item-name',
  'update:layout',
])

const layoutOptions = [
  { id: 'cards', label: 'Cards' },
  { id: 'spreadsheet', label: 'Sheet' },
  { id: 'chat', label: 'Walkthrough' },
]
</script>

<template>
  <div class="screen">
    <div v-if="selectedGroup" class="section-pad" style="padding-top: 24px; padding-bottom: 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
      <div>
        <span class="tape">Manual ledger</span>
        <h1 class="h-display" style="font-size: 36px; line-height: 1; margin: 8px 0 0;">
          {{ selectedGroup.name }}
        </h1>
        <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 4px;">
          {{ selectedGroup.memberships.length }} PEOPLE · {{ selectedGroup.bills.length }} SAVED BILLS
        </div>
      </div>

      <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
        <button
          v-for="option in layoutOptions"
          :key="option.id"
          class="chip"
          :style="{
            background: layout === option.id ? 'var(--ink)' : 'rgba(20,18,16,0.08)',
            color: layout === option.id ? 'var(--cream)' : 'var(--ink)',
          }"
          @click="emit('update:layout', option.id)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="selectedGroup" class="section-pad assign-layout" style="padding-bottom: 96px;">
      <div class="assign-sidebar">
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

        <div style="background: var(--ink); color: var(--cream); border-radius: 22px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6;">
              Remaining
            </span>
            <span class="h-display" style="font-size: 34px;">
              {{ formatCents(billRemainingCents) }}
            </span>
          </div>
          <div class="mono" style="font-size: 11px; opacity: 0.5; margin-bottom: 12px;">
            Items + tip must equal the bill total
          </div>
          <button class="btn btn-accent btn-block" :disabled="saving || !canCreateBill" @click="emit('save')">
            Save bill
            <IconGlyph name="chevron" width="16" height="16" />
          </button>
          <button class="btn btn-ghost btn-block" style="margin-top: 10px;" @click="emit('reset')">
            Reset form
          </button>
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
              <input
                :value="billTotal"
                type="text"
                placeholder="43.00"
                style="width: 100%; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
                @input="emit('update:bill-total', $event.target.value)"
              >
            </label>

            <label style="display: grid; gap: 6px;">
              <span class="mono" style="font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">Tip</span>
              <input
                :value="billTip"
                type="text"
                placeholder="4.00"
                style="width: 100%; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
                @input="emit('update:bill-tip', $event.target.value)"
              >
            </label>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
            <div>
              <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
                Receipt items
              </div>
              <div style="font-size: 14px; line-height: 1.45; margin-top: 4px;">
                Leave every item blank if you want the app to fall back to an even split across the whole group.
              </div>
            </div>

            <button class="btn btn-primary" style="padding: 10px 16px;" @click="emit('add-item')">
              Add item
            </button>
          </div>

          <div v-if="layout === 'cards'" style="display: flex; flex-direction: column; gap: 10px;">
            <div
              v-for="item in billItems"
              :key="item.id"
              class="surface-panel"
              style="padding: 14px;"
            >
              <div style="display: grid; gap: 10px;" class="profile-grid">
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
                  <input
                    :value="item.amount"
                    type="text"
                    placeholder="12.50"
                    style="width: 100%; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
                    @input="emit('update:item-amount', item.id, $event.target.value)"
                  >
                </label>
              </div>

              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px;">
                <button
                  v-for="membership in selectedGroup.memberships"
                  :key="`${item.id}-${membership.personId}`"
                  :style="{
                    padding: '8px 12px',
                    borderRadius: '999px',
                    border: item.assignedPersonIds.includes(membership.personId) ? '1.5px solid var(--ink)' : '1.5px solid rgba(20,18,16,0.12)',
                    background: item.assignedPersonIds.includes(membership.personId) ? 'var(--ink)' : 'var(--paper)',
                    color: item.assignedPersonIds.includes(membership.personId) ? 'var(--cream)' : 'var(--ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }"
                  @click="emit('toggle-assignment', item.id, membership.personId)"
                >
                  {{ membership.person.name }}
                </button>
              </div>

              <button
                style="margin-top: 12px; color: var(--tomato); font-size: 12px; font-weight: 700;"
                @click="emit('remove-item', item.id)"
              >
                Remove item
              </button>
            </div>
          </div>

          <div
            v-else-if="layout === 'spreadsheet'"
            class="surface-panel"
            style="overflow: hidden;"
          >
            <div
              :style="{
                display: 'grid',
                gridTemplateColumns: `1.2fr 0.8fr repeat(${selectedGroup.memberships.length}, minmax(54px, 1fr)) 60px`,
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                background: 'var(--ink)',
                color: 'var(--cream)',
                padding: '6px 0',
              }"
            >
              <div style="padding-left: 10px;">Item</div>
              <div style="text-align: center;">Price</div>
              <div v-for="membership in selectedGroup.memberships" :key="`head-${membership.personId}`" style="text-align: center;">
                {{ membership.person.name.charAt(0) }}
              </div>
              <div style="text-align: center;">Del</div>
            </div>

            <div
              v-for="(item, index) in billItems"
              :key="item.id"
              :style="{
                display: 'grid',
                gridTemplateColumns: `1.2fr 0.8fr repeat(${selectedGroup.memberships.length}, minmax(54px, 1fr)) 60px`,
                alignItems: 'center',
                padding: '10px 0',
                borderTop: index === 0 ? 'none' : '1px solid rgba(20,18,16,0.08)',
                fontSize: '12px',
              }"
            >
              <div style="padding-left: 10px; padding-right: 8px;">
                <input
                  :value="item.name"
                  type="text"
                  placeholder="Item"
                  style="width: 100%; border: none; background: transparent; outline: none;"
                  @input="emit('update:item-name', item.id, $event.target.value)"
                >
              </div>

              <div style="padding: 0 8px;">
                <input
                  :value="item.amount"
                  type="text"
                  placeholder="0.00"
                  style="width: 100%; border: none; background: transparent; outline: none; text-align: center;"
                  @input="emit('update:item-amount', item.id, $event.target.value)"
                >
              </div>

              <div
                v-for="membership in selectedGroup.memberships"
                :key="`${item.id}-${membership.personId}`"
                style="text-align: center;"
              >
                <button
                  :style="{
                    width: '18px',
                    height: '18px',
                    borderRadius: '9px',
                    margin: '0 auto',
                    background: item.assignedPersonIds.includes(membership.personId) ? 'var(--marigold)' : 'transparent',
                    border: item.assignedPersonIds.includes(membership.personId) ? '1.5px solid var(--ink)' : '1.5px dashed rgba(20,18,16,0.2)',
                  }"
                  @click="emit('toggle-assignment', item.id, membership.personId)"
                />
              </div>

              <div style="text-align: center;">
                <button style="color: var(--tomato); font-size: 12px;" @click="emit('remove-item', item.id)">
                  ×
                </button>
              </div>
            </div>
          </div>

          <div v-else style="display: grid; gap: 10px;">
            <div style="background: var(--marigold); color: var(--ink); border-radius: 16px; padding: 12px 14px; border: 1.5px solid var(--ink);">
              <div style="font-weight: 700; font-size: 13px;">
                Penny walkthrough
              </div>
              <div style="font-size: 13px; line-height: 1.45; margin-top: 6px;">
                Add receipt rows one by one, then tap the people who should share each row. The preview updates immediately before anything is saved.
              </div>
            </div>

            <div
              v-for="item in billItems"
              :key="item.id"
              class="surface-panel"
              style="padding: 14px;"
            >
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 34px; height: 34px; border-radius: 12px; background: var(--ink); color: var(--cream); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">
                  {{ item.name.trim() ? item.name.trim().charAt(0).toUpperCase() : '?' }}
                </div>
                <div style="flex: 1; min-width: 0;">
                  <input
                    :value="item.name"
                    type="text"
                    placeholder="What was ordered?"
                    style="width: 100%; border: none; background: transparent; outline: none; font-size: 14px; font-weight: 600;"
                    @input="emit('update:item-name', item.id, $event.target.value)"
                  >
                </div>
                <input
                  :value="item.amount"
                  type="text"
                  placeholder="0.00"
                  style="width: 84px; border: none; background: transparent; outline: none; font-size: 14px; text-align: right;"
                  @input="emit('update:item-amount', item.id, $event.target.value)"
                >
              </div>

              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px;">
                <button
                  v-for="membership in selectedGroup.memberships"
                  :key="`${item.id}-${membership.personId}`"
                  class="chip"
                  :style="{
                    background: item.assignedPersonIds.includes(membership.personId) ? 'var(--tomato)' : 'rgba(20,18,16,0.08)',
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

    <div v-else class="section-pad" style="padding-top: 24px; padding-bottom: 96px;">
      <div class="surface-panel" style="padding: 22px;">
        <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
          No group selected
        </div>
        <div style="font-size: 15px; line-height: 1.5; margin-top: 8px;">
          Go to Groups first, pick a group, and add at least one member before creating a bill.
        </div>
      </div>
    </div>
  </div>
</template>
