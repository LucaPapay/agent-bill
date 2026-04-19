<script setup>
import IconGlyph from '../app/IconGlyph.vue'

defineProps({
  message: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <div
    class="flex items-end gap-2.5"
    :class="message.role === 'user' ? 'justify-end' : ''"
  >
    <div
      v-if="message.role !== 'user'"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
      :class="message.role === 'system'
        ? 'bg-white/8 text-[rgba(246,240,228,0.7)]'
        : 'bg-[rgba(246,181,51,0.16)] text-[var(--marigold)]'"
    >
      <IconGlyph
        :name="message.role === 'system' ? 'scan' : 'sparkle'"
        width="16"
        height="16"
      />
    </div>

    <div
      class="max-w-[min(100%,680px)] rounded-[22px] px-4 py-3.5 text-sm leading-6"
      :class="message.role === 'user'
        ? 'bg-[var(--cream)] text-[var(--ink)]'
        : 'bg-white/8 text-[var(--cream)]'"
    >
      {{ message.text }}
    </div>
  </div>
</template>
