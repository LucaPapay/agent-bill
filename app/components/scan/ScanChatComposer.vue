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
  <div class="grid gap-2.5 border-t border-white/8 px-5 pt-4 pb-5">
    <form class="grid gap-2.5 md:grid-cols-[auto_minmax(0,1fr)_auto]" @submit.prevent="emit('send')">
      <button
        type="button"
        class="inline-flex min-w-[116px] items-center justify-center gap-2.5 rounded-full bg-[var(--marigold)] px-[18px] py-[13px] font-bold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-55 max-md:w-full"
        :disabled="!canPickReceipt"
        @click="emit('pick-receipt')"
      >
        <IconGlyph name="scan" width="18" height="18" />
        <span>{{ uploadLabel }}</span>
      </button>

      <div class="relative flex min-h-[52px] min-w-0 items-center gap-2 rounded-full border border-white/12 bg-white/8 py-[6px] pr-[14px] pl-2">
        <button
          v-if="showVoiceButton"
          type="button"
          class="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--tomato)] text-[var(--cream)] shadow-[0_8px_20px_rgba(255,84,54,0.28),inset_0_-2px_0_rgba(0,0,0,0.18)] disabled:cursor-not-allowed"
          :class="{
            'opacity-72': isTranscribingVoice,
            'shadow-[0_0_0_3px_rgba(255,84,54,0.18),inset_0_-2px_0_rgba(0,0,0,0.18)]': isRecordingVoice,
          }"
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
          class="min-w-0 flex-1 border-0 bg-transparent p-0 text-[var(--cream)] outline-none placeholder:text-[rgba(246,240,228,0.45)]"
          :placeholder="composerPlaceholder"
          @input="onInput"
        >
      </div>

      <button
        type="submit"
        class="inline-flex min-w-[92px] items-center justify-center rounded-full bg-[var(--cream)] px-[18px] py-[13px] font-bold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-55 max-md:w-full"
        :disabled="!canSend"
      >
        Send
      </button>
    </form>

    <div class="flex flex-wrap items-center gap-3">
      <button
        v-if="selectedGroupName"
        type="button"
        class="text-[13px] font-semibold text-[rgba(246,240,228,0.72)]"
        @click="emit('clear-group')"
      >
        Change group
      </button>

      <button
        v-if="canReset"
        type="button"
        class="text-[13px] font-semibold text-[rgba(246,240,228,0.72)]"
        @click="emit('reset')"
      >
        Reset
      </button>

      <span
        v-if="voiceStatusLabel"
        class="text-[13px] font-semibold text-[rgba(246,240,228,0.72)]"
        :class="{ 'text-[#ffd2ca]': !isRecordingVoice && !isTranscribingVoice }"
      >
        {{ voiceStatusLabel }}
      </span>
    </div>
  </div>
</template>
