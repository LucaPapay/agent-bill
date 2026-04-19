<script setup>
import { nextTick, ref, watch } from 'vue'
import ScanChatMessageGroupSelect from './ScanChatMessageGroupSelect.vue'
import ScanChatMessageLoading from './ScanChatMessageLoading.vue'
import ScanChatMessagePreview from './ScanChatMessagePreview.vue'
import ScanChatMessageReceipt from './ScanChatMessageReceipt.vue'
import ScanChatMessageText from './ScanChatMessageText.vue'
import ScanToolCallRow from './ScanToolCallRow.vue'

const props = defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['pick-group'])
const scrollRef = ref(null)

function scrollToBottom() {
  nextTick(() => {
    if (!scrollRef.value) {
      return
    }

    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  })
}

watch(() => props.messages, scrollToBottom, { deep: true })
</script>

<template>
  <div
    ref="scrollRef"
    class="chat-stream flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-5"
  >
    <template v-for="message in messages" :key="message.id || `${message.kind}-${message.text}`">
      <ScanChatMessageText
        v-if="message.kind === 'text'"
        :message="message"
      />

      <ScanChatMessagePreview
        v-else-if="message.kind === 'preview'"
        :message="message"
      />

      <ScanToolCallRow
        v-else-if="message.kind === 'tool'"
        :state="message.data?.state || 'done'"
        :tool-name="message.data?.toolName || ''"
      />

      <ScanChatMessageReceipt
        v-else-if="message.kind === 'receipt'"
        :message="message"
      />

      <ScanChatMessageGroupSelect
        v-else-if="message.kind === 'group_select'"
        :message="message"
        @select-group="emit('pick-group', $event)"
      />

      <ScanChatMessageLoading
        v-else-if="message.kind === 'loading'"
        :message="message"
      />
    </template>
  </div>
</template>
