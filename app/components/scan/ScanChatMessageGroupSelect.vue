<script setup>
import IconGlyph from '../app/IconGlyph.vue'

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['select-group'])
</script>

<template>
  <div class="scan-chat-row">
    <div class="scan-avatar system">
      <IconGlyph name="scan" width="16" height="16" />
    </div>

    <div class="scan-bubble system">
      <div v-if="message.text">
        {{ message.text }}
      </div>

      <div class="scan-choice-row scan-choice-row-inline">
        <button
          v-for="group in message.data?.groups || []"
          :key="group.id"
          type="button"
          class="scan-choice-button"
          @click="emit('select-group', group.id)"
        >
          {{ group.name }}
        </button>
      </div>
    </div>
  </div>
</template>
