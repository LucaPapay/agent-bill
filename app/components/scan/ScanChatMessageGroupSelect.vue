<script setup>
import IconGlyph from '../app/IconGlyph.vue'

defineProps({
  groups: {
    type: Array,
    default: () => [],
  },
  text: {
    type: String,
    default: 'Pick the group for this receipt.',
  },
})

const emit = defineEmits(['select-group'])
</script>

<template>
  <div class="flex items-end gap-2.5">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[rgba(246,240,228,0.7)]">
      <IconGlyph name="scan" width="16" height="16" />
    </div>

    <div class="max-w-[min(100%,680px)] rounded-[22px] bg-white/8 px-4 py-3.5 text-sm leading-6 text-[var(--cream)]">
      <div v-if="text">
        {{ text }}
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="group in groups"
          :key="group.id"
          type="button"
          class="rounded-full border border-white/12 bg-white/8 px-3.5 py-2.5 text-[13px] font-semibold text-[var(--cream)] transition hover:bg-white/12"
          @click="emit('select-group', group.id)"
        >
          {{ group.name }}
        </button>
      </div>
    </div>
  </div>
</template>
