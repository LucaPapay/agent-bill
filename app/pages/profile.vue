<script setup lang="ts">
import PageShell from '../components/layout/PageShell.vue'
import ProfileScreen from '../components/screens/ProfileScreen.vue'

const { health, ledger } = useLedgerState()
</script>

<template>
  <PageShell>
    <ProfileScreen :health="health" :ledger="ledger" />
  </PageShell>
</template>
