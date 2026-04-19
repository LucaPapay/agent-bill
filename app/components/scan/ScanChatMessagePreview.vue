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
  <div class="flex items-end gap-2.5">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(246,181,51,0.16)] text-[var(--marigold)]">
      <IconGlyph name="sparkle" width="16" height="16" />
    </div>

    <div class="w-[min(100%,720px)] overflow-hidden rounded-3xl shadow-[0_20px_38px_rgba(24,16,10,0.18)] [&_.receipt-split-stage]:min-h-[320px]">
      <ReceiptSplitPreview
        :image-src="message.data?.imageSrc || ''"
        :status="message.data?.status || ''"
        :title="message.data?.title || 'Receipt preview'"
        :total-label="message.data?.totalLabel || ''"
      />
    </div>
  </div>
</template>
