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
  <div class="flex items-end gap-2.5">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(246,181,51,0.16)] text-[var(--marigold)]">
      <IconGlyph name="sparkle" width="16" height="16" />
    </div>

    <ScanReceiptCard
      :receipt="message.data?.receipt || {}"
      :split-rows="message.data?.splitRows || []"
      :summary="message.data?.summary || ''"
    />
  </div>
</template>
