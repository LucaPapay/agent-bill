<script setup>
defineProps({
  personName: {
    type: String,
    default: '',
  },
  saving: Boolean,
})

const emit = defineEmits(['submit', 'update:personName'])
</script>

<template>
  <form class="surface-panel" style="padding: 18px;" @submit.prevent="emit('submit')">
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
      @input="emit('update:personName', $event.target.value)"
    >
    <button class="btn btn-primary btn-block" style="margin-top: 12px;" :disabled="saving || !personName.trim()">
      Add person
    </button>
  </form>
</template>
