<script setup>
import IconGlyph from '../app/IconGlyph.vue'
import ReceiptSplitPreview from './ReceiptSplitPreview.vue'

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

    <div class="scan-preview-stage">
      <ReceiptSplitPreview
        :image-src="message.data?.imageSrc || ''"
        :status="message.data?.status || ''"
        :title="message.data?.title || 'Receipt preview'"
        :total-label="message.data?.totalLabel || ''"
      />
    </div>
  </div>
</template>
