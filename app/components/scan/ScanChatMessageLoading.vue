<script setup>
import PennyLoadingIndicator from './PennyLoadingIndicator.vue'

defineProps({
  message: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <PennyLoadingIndicator
    :loading-chat="Boolean(message.data?.loadingChat)"
    :status="message.data?.status || 'idle'"
  />
</template>
