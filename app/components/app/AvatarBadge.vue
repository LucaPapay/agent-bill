<script setup>
import { computed } from 'vue'
import { avatarColors } from './mockData'

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

const avatarStyle = computed(() => ({
  background: avatarColors[props.name] || '#8FC56A',
}))

const initial = computed(() => props.name.charAt(0).toUpperCase())
</script>

<template>
  <div class="avatar" :class="size" :style="avatarStyle">
    {{ initial }}
  </div>
</template>
