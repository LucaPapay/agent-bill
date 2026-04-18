<script setup lang="ts">
import PageShell from '../components/layout/PageShell.vue'
import ChatSplitScreen from '../components/screens/ChatSplitScreen.vue'

const { selectedGroupId } = useLedgerState()

function openComposer() {
  navigateTo(selectedGroupId.value ? `/groups/${selectedGroupId.value}/bills/new` : '/groups')
}
</script>

<template>
  <PageShell>
    <ChatSplitScreen @done="openComposer" @jump-to-items="openComposer" />
  </PageShell>
</template>
