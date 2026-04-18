<script setup lang="ts">
import PageShell from '../components/layout/PageShell.vue'
import ScanScreen from '../components/screens/ScanScreen.vue'

function openChatSplit() {
  navigateTo('/chat-split')
}
</script>

<template>
  <PageShell>
    <ScanScreen @done="openChatSplit" />
  </PageShell>
</template>
