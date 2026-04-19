<script setup>
import IconGlyph from '../app/IconGlyph.vue'
import ScanReceiptCard from './ScanReceiptCard.vue'

defineProps({
  message: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <div class="scan-chat-row">
    <div class="scan-avatar">
      <IconGlyph name="sparkle" width="16" height="16" />
    </div>

    <ScanReceiptCard
      :receipt="message.data?.receipt || {}"
      :split-rows="message.data?.splitRows || []"
      :summary="message.data?.summary || ''"
    />
  </div>
</template>
