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
      toneClass: 'text-tomato',
    }
  }

  if (balanceCents > 0) {
    return {
      label: `is owed ${props.formatCents(balanceCents)}`,
      toneClass: 'text-mint',
    }
  }

  return {
    label: 'settled',
    toneClass: 'text-muted',
  }
}
</script>

<template>
  <div class="grid gap-4">
    <div class="surface-panel p-[18px]">
      <div class="section-label mb-2.5">
        Members
      </div>
      <div v-if="group?.memberships?.length" class="grid gap-2">
        <div
          v-for="membership in group.memberships"
          :key="membership.id"
          class="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2.5"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <AvatarBadge :name="membership.person.name" size="sm" />
            <div class="text-sm font-semibold">
              {{ membership.person.name }}
            </div>
          </div>

          <div
            class="mono shrink-0 text-right text-[11px]"
            :class="getMemberBalance(membership.personId).toneClass"
          >
            {{ getMemberBalance(membership.personId).label }}
          </div>
        </div>
      </div>
      <div v-else class="rounded-2xl bg-paper px-[14px] py-3 text-[13px]">
        Add people before creating itemized bills in this group.
      </div>
    </div>

    <div class="surface-panel p-[18px]">
      <div class="section-label mb-2.5">
        Invite by email
      </div>
      <form @submit.prevent="emit('add-person')">
        <input
          :value="personToAddEmail"
          type="email"
          placeholder="name@example.com"
          class="form-input"
          @input="emit('update:personToAddEmail', $event.target.value)"
        />

        <div class="mt-2 text-xs leading-[1.5] text-muted">
          Enter the email address of an existing user. If no account matches that email, nothing gets added.
        </div>

        <button class="btn btn-primary btn-block mt-3" :disabled="saving || !canAddPersonToGroup">
          Add to group
        </button>
      </form>
    </div>
  </div>
</template>
