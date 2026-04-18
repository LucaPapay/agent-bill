<script setup>
import { computed } from 'vue'

const fallbackPalette = ['#F6B533', '#FF5436', '#8FC56A', '#B9A6E8', '#7FB8D9', '#E89E6C', '#D9B38F']

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    default: 'md',
  },
})

function colorFromName(name) {
  let hash = 0

  for (const char of name) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0)
    hash |= 0
  }

  return fallbackPalette[Math.abs(hash) % fallbackPalette.length]
}

const avatarStyle = computed(() => ({
  background: colorFromName(props.name),
}))

const initial = computed(() => props.name.charAt(0).toUpperCase())
</script>

<template>
  <div class="avatar" :class="size" :style="avatarStyle">
    {{ initial }}
  </div>
</template>
