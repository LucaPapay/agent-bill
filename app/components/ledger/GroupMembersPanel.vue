<script setup>
import { computed } from 'vue'
import AvatarBadge from '../app/AvatarBadge.vue'

const props = defineProps({
  canAddPersonToGroup: Boolean,
  formatCents: {
    type: Function,
    default: (value) => String(value),
  },
  group: {
    type: Object,
    default: null,
  },
  personToAddEmail: {
    type: String,
    default: '',
  },
  saving: Boolean,
})

const emit = defineEmits(['add-person', 'update:personToAddEmail'])

const memberBalanceByPersonId = computed(() => {
  const balances = {}

  for (const membership of props.group?.memberships || []) {
    balances[membership.personId] = 0
  }

  for (const transfer of props.group?.simplifiedTransfers || []) {
    balances[transfer.fromPersonId] = (balances[transfer.fromPersonId] || 0) - transfer.amountCents
    balances[transfer.toPersonId] = (balances[transfer.toPersonId] || 0) + transfer.amountCents
  }

  return balances
})

function getMemberBalance(personId) {
  const balanceCents = memberBalanceByPersonId.value[personId] || 0

  if (balanceCents < 0) {
    return {
      label: `owes ${props.formatCents(Math.abs(balanceCents))}`,
      tone: 'var(--tomato)',
    }
  }

  if (balanceCents > 0) {
    return {
      label: `is owed ${props.formatCents(balanceCents)}`,
      tone: 'var(--mint)',
    }
  }

  return {
    label: 'settled',
    tone: 'var(--muted)',
  }
}
</script>

<template>
  <div style="display: grid; gap: 16px;">
    <div class="surface-panel" style="padding: 18px;">
      <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">
        Members
      </div>
      <div v-if="group?.memberships?.length" style="display: grid; gap: 8px;">
        <div
          v-for="membership in group.memberships"
          :key="membership.id"
          style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 16px; background: var(--paper);"
        >
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <AvatarBadge :name="membership.person.name" size="sm" />
            <div style="font-size: 14px; font-weight: 600;">
              {{ membership.person.name }}
            </div>
          </div>

          <div
            class="mono"
            :style="{ fontSize: '11px', color: getMemberBalance(membership.personId).tone, textAlign: 'right', flexShrink: 0 }"
          >
            {{ getMemberBalance(membership.personId).label }}
          </div>
        </div>
      </div>
      <div v-else style="padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
        Add people before creating itemized bills in this group.
      </div>
    </div>

    <div class="surface-panel" style="padding: 18px;">
      <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">
        Invite by email
      </div>
      <form @submit.prevent="emit('add-person')">
        <input
          :value="personToAddEmail"
          type="email"
          placeholder="name@example.com"
          style="width: 100%; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
          @input="emit('update:personToAddEmail', $event.target.value)"
        />

        <div style="margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.5;">
          Enter the email address of an existing user. If no account matches that email, nothing gets added.
        </div>

        <button class="btn btn-primary btn-block" style="margin-top: 12px;" :disabled="saving || !canAddPersonToGroup">
          Add to group
        </button>
      </form>
    </div>
  </div>
</template>
