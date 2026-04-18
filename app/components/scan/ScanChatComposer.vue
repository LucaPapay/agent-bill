<script setup>
import IconGlyph from '../app/IconGlyph.vue'

defineProps({
  canPickReceipt: {
    type: Boolean,
    default: false,
  },
  canRecordVoice: {
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
  isRecordingVoice: {
    type: Boolean,
    default: false,
  },
  isTranscribingVoice: {
    type: Boolean,
    default: false,
  },
  modelValue: {
    type: String,
    default: '',
  },
  selectedGroupName: {
    type: String,
    default: '',
  },
  showVoiceButton: {
    type: Boolean,
    default: false,
  },
  uploadLabel: {
    type: String,
    default: 'Upload',
  },
  voiceStatusLabel: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'clear-group',
  'pick-receipt',
  'reset',
  'send',
  'toggle-voice',
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

      <div class="scan-composer-input-wrap" :class="{ 'has-voice-button': showVoiceButton }">
        <button
          v-if="showVoiceButton"
          type="button"
          class="scan-voice-trigger scan-voice-trigger-inline"
          :class="{ 'is-recording': isRecordingVoice, 'is-busy': isTranscribingVoice }"
          :disabled="(!canRecordVoice && !isRecordingVoice) || isTranscribingVoice"
          :aria-label="isRecordingVoice ? 'Stop voice recording' : 'Start voice recording'"
          :aria-pressed="isRecordingVoice ? 'true' : 'false'"
          @click="emit('toggle-voice')"
        >
          <span v-if="isRecordingVoice" class="voice-pulse" aria-hidden="true" />
          <IconGlyph name="mic" width="18" height="18" />
        </button>

        <input
          :value="modelValue"
          type="text"
          class="scan-composer-input"
          :placeholder="composerPlaceholder"
          @input="onInput"
        >
      </div>

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

      <span
        v-if="voiceStatusLabel"
        class="scan-voice-status"
        :class="{ 'is-error': !isRecordingVoice && !isTranscribingVoice }"
      >
        {{ voiceStatusLabel }}
      </span>
    </div>
  </div>
</template>
