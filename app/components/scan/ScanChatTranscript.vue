<script setup>
import ScanChatMessagePreview from './ScanChatMessagePreview.vue'
import ScanChatMessageText from './ScanChatMessageText.vue'
import ScanToolCallRow from './ScanToolCallRow.vue'

const props = defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  previewStatus: {
    type: String,
    default: '',
  },
  previewTotalLabel: {
    type: String,
    default: '',
  },
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
        :status="previewStatus"
        :total-label="previewTotalLabel"
      />

      <ScanToolCallRow
        v-else-if="message?.data?.toolName"
        :state="message.data?.state || 'done'"
        :tool-name="message.data?.toolName || ''"
      />

    </template>
  </div>
</template>
