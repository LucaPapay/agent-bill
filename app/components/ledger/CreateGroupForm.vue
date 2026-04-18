<script setup>
defineProps({
  groupName: {
    type: String,
    default: '',
  },
  saving: Boolean,
})

const emit = defineEmits(['submit', 'update:groupName'])
</script>

<template>
  <form class="surface-panel" style="padding: 18px;" @submit.prevent="emit('submit')">
    <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
      Create group
    </div>
    <div style="font-size: 14px; line-height: 1.5; margin-top: 8px;">
      Groups own bills, raw transfers, and the simplified settlement. Penny picks the icon and background color.
    </div>
    <input
      :value="groupName"
      type="text"
      placeholder="Flat dinner club"
      style="width: 100%; margin-top: 14px; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
      @input="emit('update:groupName', $event.target.value)"
    >
    <button class="btn btn-accent btn-block" style="margin-top: 12px;" :disabled="saving || !groupName.trim()">
      Add group
    </button>
  </form>
</template>
