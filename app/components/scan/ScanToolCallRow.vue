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
  <div class="scan-chat-row">
    <div class="scan-avatar system">
      <IconGlyph name="scan" width="16" height="16" />
    </div>

    <div class="scan-bubble system scan-tool-call" :class="`is-${state}`">
      <div class="scan-tool-call-copy">
        {{ formattedToolName }}
      </div>
      <div v-if="state === 'running'" class="scan-tool-call-dot" />
    </div>
  </div>
</template>
