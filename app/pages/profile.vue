<script setup lang="ts">
import PageShell from '../components/layout/PageShell.vue'
import ProfileScreen from '../components/screens/ProfileScreen.vue'

const { clear, user } = useUserSession()
const { health, ledger, resetState } = useLedgerState()

async function logout() {
  await clear()
  resetState()
  await navigateTo('/login')
}
</script>

<template>
  <PageShell>
    <ProfileScreen :current-user="user || undefined" :health="health" :ledger="ledger" @logout="logout" />
  </PageShell>
</template>
