<script setup>
import IconGlyph from '../app/IconGlyph.vue'

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
})

function getAvatarClass(role) {
  return role === 'system' ? 'system' : ''
}

function getAvatarName(role) {
  return role === 'system' ? 'scan' : 'sparkle'
}

function getRowClass(role) {
  if (role === 'user') {
    return 'user'
  }

  if (role === 'system') {
    return 'system'
  }

  return ''
}

function getBubbleClass(role) {
  if (role === 'user') {
    return 'user'
  }

  if (role === 'system') {
    return 'system'
  }

  return 'assistant'
}
</script>

<template>
  <div
    class="scan-chat-row"
    :class="getRowClass(message.role)"
  >
    <div v-if="message.role !== 'user'" class="scan-avatar" :class="getAvatarClass(message.role)">
      <IconGlyph :name="getAvatarName(message.role)" width="16" height="16" />
    </div>

    <div class="scan-bubble" :class="getBubbleClass(message.role)">
      {{ message.text }}
    </div>
  </div>
</template>
