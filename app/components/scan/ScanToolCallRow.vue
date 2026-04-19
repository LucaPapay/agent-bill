<script setup>
import { computed } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'

const props = defineProps({
  state: {
    type: String,
    default: 'done',
  },
  toolName: {
    type: String,
    required: true,
  },
})

const formattedToolName = computed(() =>
  String(props.toolName || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase()),
)
</script>

<template>
  <div class="flex items-end gap-2.5">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[rgba(246,240,228,0.7)]">
      <IconGlyph name="scan" width="16" height="16" />
    </div>

    <div
      class="flex w-[min(100%,680px)] items-center justify-between gap-2.5 rounded-[22px] bg-white/8 px-4 py-3.5 text-sm text-[var(--cream)]"
      :class="state === 'running'
        ? 'border border-[rgba(246,181,51,0.16)]'
        : state === 'error'
          ? 'border border-[rgba(255,84,54,0.32)]'
          : ''"
    >
      <div class="text-sm font-semibold">
        {{ formattedToolName }}
      </div>
      <div
        v-if="state === 'running'"
        class="h-2 w-2 shrink-0 rounded-full bg-[rgba(246,181,51,0.9)] shadow-[0_0_0_4px_rgba(246,181,51,0.12)]"
      />
    </div>
  </div>
</template>
