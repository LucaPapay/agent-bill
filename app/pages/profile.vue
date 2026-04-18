<script setup lang="ts">
import PageShell from '../components/layout/PageShell.vue'
import ProfileScreen from '../components/screens/ProfileScreen.vue'

const { clearCurrentUser, currentUser, health, ledger } = useLedgerState()

function switchUser() {
  clearCurrentUser()
  navigateTo('/login')
}
</script>

<template>
  <PageShell>
    <ProfileScreen :current-user="currentUser" :health="health" :ledger="ledger" @switch-user="switchUser" />
  </PageShell>
</template>
