<script setup lang="ts">
import PageShell from '../components/layout/PageShell.vue'
import ProfileScreen from '../components/screens/ProfileScreen.vue'

const { clear, user } = useUserSession()
const {
  addCurrentUserToAllGroups,
  createPerson,
  errorMessage,
  health,
  ledger,
  personName,
  resetState,
  saving,
} = useLedgerState()

async function logout() {
  await clear()
  resetState()
  await navigateTo('/login')
}

function addToAllGroups() {
  return addCurrentUserToAllGroups()
}

function submitPerson() {
  return createPerson()
}
</script>

<template>
  <PageShell>
    <ProfileScreen
      :current-user="user || undefined"
      :error-message="errorMessage"
      :health="health"
      :ledger="ledger"
      :person-name="personName"
      :saving="saving"
      @add-to-all-groups="addToAllGroups"
      @logout="logout"
      @submit-person="submitPerson"
      @update:person-name="personName = $event"
    />
  </PageShell>
</template>
