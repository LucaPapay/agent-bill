<script setup lang="ts">
import { onMounted, watch } from 'vue'
import PageShell from '../../components/layout/PageShell.vue'
import ScanScreen from '../../components/screens/ScanScreen.vue'
import { useBillAnalysisStream } from '../../composables/useBillAnalysisStream'

const route = useRoute()
const analysis = useBillAnalysisStream()

async function ensureChatLoaded() {
  const chatId = String(route.params.chatId || '').trim()

  if (!chatId) {
    return
  }

  await analysis.loadChat(chatId)
}

watch(() => route.params.chatId, () => {
  void ensureChatLoaded()
}, { immediate: true })

onMounted(() => {
  void ensureChatLoaded()
})
</script>

<template>
  <PageShell>
    <ScanScreen
      :key="String(route.params.chatId || 'scan-chat')"
      :chat-id="String(route.params.chatId || '')"
    />
  </PageShell>
</template>
