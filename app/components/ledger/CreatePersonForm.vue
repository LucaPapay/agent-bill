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
  <form class="surface-panel p-[18px]" @submit.prevent="emit('submit')">
    <div class="section-label">
      Create person
    </div>
    <div class="mt-2 text-sm leading-[1.5]">
      People are global records that can belong to many groups.
    </div>
    <input
      :value="personName"
      type="text"
      placeholder="Jojo"
      class="form-input mt-[14px]"
      @input="emit('update:personName', $event.target.value)"
    >
    <button class="btn btn-primary btn-block mt-3" :disabled="saving || !personName.trim()">
      Add person
    </button>
  </form>
</template>
