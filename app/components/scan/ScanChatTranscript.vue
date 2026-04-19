<script setup>
import { computed } from 'vue'
import ScanChatMessagePreview from './ScanChatMessagePreview.vue'
import ScanChatMessageText from './ScanChatMessageText.vue'
import ScanToolCallRow from './ScanToolCallRow.vue'

const props = defineProps({
  context: {
    type: Object,
    default: null,
  },
  messages: {
    type: Array,
    default: () => [],
  },
})

const totalLabel = computed(() => {
  if (!props.context?.receipt) {
    return ''
  }

  return new Intl.NumberFormat('en-US', {
    currency: props.context.receipt.currency || 'EUR',
    style: 'currency',
  }).format((props.context.receipt.totalCents || 0) / 100)
})
</script>

<template>
  <div
    class="flex flex-col gap-3.5 p-5"
  >
    <template v-for="(message, index) in messages" :key="message.id || `${index}-${message.role}-${message.text}`">
      <ScanChatMessageText
        v-if="!message?.data?.imageBase64 && !message?.data?.toolName"
        :message="message"
      />

      <ScanChatMessagePreview
        v-else-if="message?.data?.imageBase64"
        :message="message"
        :status="context?.status || ''"
        :total-label="totalLabel"
      />

      <ScanToolCallRow
        v-else-if="message?.data?.toolName"
        :state="message.data?.state || 'done'"
        :tool-name="message.data?.toolName || ''"
      />

    </template>
  </div>
</template>
