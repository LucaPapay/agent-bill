<script setup lang="ts">
import PageShell from '../components/layout/PageShell.vue'
import ProfileScreen from '../components/screens/ProfileScreen.vue'

const { clear, user } = useUserSession()
const { addCurrentUserToAllGroups, errorMessage, health, ledger, resetState, saving } = useLedgerState()

async function logout() {
  await clear()
  resetState()
  await navigateTo('/login')
}

function addToAllGroups() {
  return addCurrentUserToAllGroups()
}
</script>

<template>
  <PageShell>
    <ProfileScreen
      :current-user="user || undefined"
      :error-message="errorMessage"
      :health="health"
      :ledger="ledger"
      :saving="saving"
      @add-to-all-groups="addToAllGroups"
      @logout="logout"
    />
  </PageShell>
</template>
