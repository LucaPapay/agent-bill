<script setup>
import IconGlyph from '../app/IconGlyph.vue'

defineProps({
  canPickReceipt: {
    type: Boolean,
    default: false,
  },
  canReset: {
    type: Boolean,
    default: false,
  },
  canSend: {
    type: Boolean,
    default: false,
  },
  composerPlaceholder: {
    type: String,
    default: '',
  },
  modelValue: {
    type: String,
    default: '',
  },
  selectedGroupName: {
    type: String,
    default: '',
  },
  uploadLabel: {
    type: String,
    default: 'Upload',
  },
})

const emit = defineEmits([
  'clear-group',
  'pick-receipt',
  'reset',
  'send',
  'update:modelValue',
])

function onInput(event) {
  emit('update:modelValue', event.target.value)
}
</script>

<template>
  <div class="scan-chat-footer">
    <form class="scan-composer" @submit.prevent="emit('send')">
      <button
        type="button"
        class="scan-upload-trigger"
        :disabled="!canPickReceipt"
        @click="emit('pick-receipt')"
      >
        <IconGlyph name="scan" width="18" height="18" />
        <span>{{ uploadLabel }}</span>
      </button>

      <input
        :value="modelValue"
        type="text"
        class="scan-composer-input"
        :placeholder="composerPlaceholder"
        @input="onInput"
      >

      <button
        type="submit"
        class="scan-send-button"
        :disabled="!canSend"
      >
        Send
      </button>
    </form>

    <div class="scan-footer-actions">
      <button
        v-if="selectedGroupName"
        type="button"
        class="scan-footer-link"
        @click="emit('clear-group')"
      >
        Change group
      </button>

      <button
        v-if="canReset"
        type="button"
        class="scan-footer-link"
        @click="emit('reset')"
      >
        Reset
      </button>
    </div>
  </div>
</template>
