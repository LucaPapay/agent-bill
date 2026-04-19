<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'

defineProps({
  canAddPersonToGroup: Boolean,
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
          style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 16px; background: var(--paper);"
        >
          <AvatarBadge :name="membership.person.name" size="sm" />
          <div style="font-size: 14px; font-weight: 600;">
            {{ membership.person.name }}
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
