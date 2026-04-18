<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import PageShell from '../components/layout/PageShell.vue'
import ScanScreen from '../components/screens/ScanScreen.vue'
import { useBillAnalysisStream } from '../composables/useBillAnalysisStream'

const route = useRoute()
const analysis = useBillAnalysisStream()

const chatId = computed(() => {
  const routeChatId = String(route.params.chatId || '').trim()

  if (routeChatId) {
    return routeChatId
  }

  const match = route.path.match(/^\/scan\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
})

async function ensureChatLoaded() {
  if (!chatId.value) {
    return
  }

  await analysis.loadChat(chatId.value)
}

watch(chatId, () => {
  void ensureChatLoaded()
}, { immediate: true })

onMounted(() => {
  void ensureChatLoaded()
})
</script>

<template>
  <PageShell>
    <ScanScreen :chat-id="chatId" />
  </PageShell>
</template>
