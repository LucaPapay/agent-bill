<script setup>
import { computed } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'
import ReceiptSplitPreview from './ReceiptSplitPreview.vue'

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
  status: {
    type: String,
    default: '',
  },
  totalLabel: {
    type: String,
    default: '',
  },
})

const imageBase64 = computed(() => String(props.message?.data?.imageBase64 || '').trim())
const mimeType = computed(() => String(props.message?.data?.mimeType || '').trim() || 'image/jpeg')
const imageSrc = computed(() =>
  imageBase64.value
    ? `data:${mimeType.value};base64,${imageBase64.value}`
    : '',
)
</script>

<template>
  <div class="flex items-end gap-2.5">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(246,181,51,0.16)] text-[var(--marigold)]">
      <IconGlyph name="sparkle" width="16" height="16" />
    </div>

    <div class="w-[min(100%,720px)] overflow-hidden rounded-3xl shadow-[0_20px_38px_rgba(24,16,10,0.18)] [&_.receipt-split-stage]:min-h-[320px]">
      <ReceiptSplitPreview
        :image-src="imageSrc"
        :status="status"
        :title="message.data?.title || 'Receipt preview'"
        :total-label="totalLabel"
      />
    </div>
  </div>
</template>
