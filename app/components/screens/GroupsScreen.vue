<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'
import GroupCard from '../app/GroupCard.vue'
import IconGlyph from '../app/IconGlyph.vue'

const props = defineProps({
  canAddPersonToGroup: Boolean,
  errorMessage: {
    type: String,
    default: '',
  },
  formatCents: {
    type: Function,
    default: value => value,
  },
  groupName: {
    type: String,
    default: '',
  },
  groups: {
    type: Array,
    default: () => [],
  },
  peopleNotInSelectedGroup: {
    type: Array,
    default: () => [],
  },
  personName: {
    type: String,
    default: '',
  },
  personToAddId: {
    type: String,
    default: '',
  },
  saving: Boolean,
  selectedGroup: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'add-person',
  'open-assign',
  'select-group',
  'submit-group',
  'submit-person',
  'update:group-name',
  'update:person-name',
  'update:person-to-add-id',
])

function groupOpenAmount(group) {
  const cents = (group.simplifiedTransfers || []).reduce((sum, transfer) => sum + transfer.amountCents, 0)

  if (!cents) {
    return 'Settled'
  }

  return `${props.formatCents(cents)} open`
}

function groupMemberNames(group) {
  return (group.memberships || []).map(membership => membership.person.name)
}

function groupIconBackground(group) {
  return props.selectedGroup?.id === group.id ? 'var(--ink)' : 'var(--marigold)'
}

function groupIconColor(group) {
  return props.selectedGroup?.id === group.id ? 'var(--cream)' : 'var(--ink)'
}
</script>

<template>
  <div class="screen">
    <div class="section-pad" style="padding-top: 8px; padding-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 class="h-display" style="font-size: 42px; line-height: 1; margin: 0;">
            Groups
          </h1>
          <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 6px;">
            {{ groups.length }} ACTIVE · LOCAL-FIRST LEDGER
          </div>
        </div>

        <button
          style="width: 40px; height: 40px; border-radius: 14px; background: var(--ink); color: var(--cream); display: flex; align-items: center; justify-content: center;"
          @click="emit('open-assign')"
        >
          <IconGlyph name="plus" width="20" height="20" />
        </button>
      </div>
    </div>

    <div class="section-pad" style="display: grid; gap: 12px; margin-bottom: 16px;">
      <div style="display: grid; gap: 12px;" class="profile-grid">
        <form class="surface-panel" style="padding: 18px;" @submit.prevent="emit('submit-person')">
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
            Create person
          </div>
          <div style="font-size: 14px; line-height: 1.5; margin-top: 8px;">
            People are global records that can belong to many groups.
          </div>
          <input
            :value="personName"
            type="text"
            placeholder="Jojo"
            style="width: 100%; margin-top: 14px; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
            @input="emit('update:person-name', $event.target.value)"
          >
          <button class="btn btn-primary btn-block" style="margin-top: 12px;" :disabled="saving || !personName.trim()">
            Add person
          </button>
        </form>

        <form class="surface-panel" style="padding: 18px;" @submit.prevent="emit('submit-group')">
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
            Create group
          </div>
          <div style="font-size: 14px; line-height: 1.5; margin-top: 8px;">
            Groups own bills, raw transfers, and the simplified settlement.
          </div>
          <input
            :value="groupName"
            type="text"
            placeholder="Flat dinner club"
            style="width: 100%; margin-top: 14px; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
            @input="emit('update:group-name', $event.target.value)"
          >
          <button class="btn btn-accent btn-block" style="margin-top: 12px;" :disabled="saving || !groupName.trim()">
            Add group
          </button>
        </form>
      </div>

      <div v-if="errorMessage" style="padding: 12px 14px; border-radius: 16px; background: #fff0ec; color: #7d2f21; border: 1px solid rgba(255,84,54,0.2); font-size: 13px;">
        {{ errorMessage }}
      </div>
    </div>

    <div class="section-pad groups-grid">
      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :amount-label="groupOpenAmount(group)"
        :avatar-names="groupMemberNames(group)"
        :icon-background="groupIconBackground(group)"
        :icon-color="groupIconColor(group)"
        :icon-label="group.name.charAt(0).toUpperCase()"
        :selected="selectedGroup?.id === group.id"
        :subtitle="`${group.bills.length} bills · ${group.memberships.length} people`"
        :title="group.name"
        @select="emit('select-group', group.id)"
      />
    </div>

    <div v-if="selectedGroup" class="section-pad" style="padding-top: 20px; padding-bottom: 92px;">
      <div class="surface-panel" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; flex-wrap: wrap;">
          <div>
            <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
              Selected group
            </div>
            <h2 class="h-display" style="font-size: 32px; line-height: 1; margin: 10px 0 0;">
              {{ selectedGroup.name }}
            </h2>
          </div>

          <button class="btn btn-accent" style="padding: 12px 16px;" @click="emit('open-assign')">
            New bill
          </button>
        </div>

        <div style="display: grid; gap: 12px; margin-top: 18px;" class="profile-grid">
          <div>
            <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">
              Members
            </div>
            <div style="display: grid; gap: 8px;">
              <div
                v-for="membership in selectedGroup.memberships"
                :key="membership.id"
                style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 16px; background: var(--paper);"
              >
                <AvatarBadge :name="membership.person.name" size="sm" />
                <div style="font-size: 14px; font-weight: 600;">
                  {{ membership.person.name }}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">
              Add existing person
            </div>
            <form @submit.prevent="emit('add-person')">
              <select
                :value="personToAddId"
                style="width: 100%; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
                @change="emit('update:person-to-add-id', $event.target.value)"
              >
                <option value="">
                  Select person
                </option>
                <option
                  v-for="person in peopleNotInSelectedGroup"
                  :key="person.id"
                  :value="person.id"
                >
                  {{ person.name }}
                </option>
              </select>
              <button class="btn btn-primary btn-block" style="margin-top: 12px;" :disabled="saving || !canAddPersonToGroup">
                Add to group
              </button>
            </form>

            <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin: 18px 0 10px;">
              Simplified settlement
            </div>
            <div v-if="selectedGroup.simplifiedTransfers.length" style="display: grid; gap: 8px;">
              <div
                v-for="transfer in selectedGroup.simplifiedTransfers"
                :key="transfer.id"
                style="padding: 12px 14px; border-radius: 16px; background: var(--ink); color: var(--cream);"
              >
                <div style="font-size: 13px; line-height: 1.45;">
                  {{ transfer.fromPerson.name }} owes {{ transfer.toPerson.name }}
                </div>
                <div class="mono" style="font-size: 13px; margin-top: 4px;">
                  {{ formatCents(transfer.amountCents) }}
                </div>
              </div>
            </div>
            <div v-else style="padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px; line-height: 1.45;">
              This group is fully settled right now.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
