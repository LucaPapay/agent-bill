<script setup lang="ts">
import PageShell from '../../components/layout/PageShell.vue'
import ScanScreen from '../../components/screens/ScanScreen.vue'

const route = useRoute()
</script>

<template>
  <PageShell>
    <ScanScreen :chat-id="String(route.params.chatId || '')" />
  </PageShell>
</template>
