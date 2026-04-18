<script setup lang="ts">
import PageShell from '../components/layout/PageShell.vue'
import HomeScreen from '../components/screens/HomeScreen.vue'

const { health, recentBillActivities, homeSummary, selectedGroupId } = useLedgerState()

function handleNav(screen: string) {
  if (screen === 'groups') {
    navigateTo('/groups')
    return
  }

  if (screen === 'scan') {
    navigateTo('/scan')
    return
  }

  if (screen === 'profile') {
    navigateTo('/profile')
    return
  }

  if (screen === 'assign') {
    navigateTo(selectedGroupId.value ? `/groups/${selectedGroupId.value}/bills/new` : '/groups')
    return
  }

  if (screen === 'settlements' || screen === 'bills') {
    navigateTo(selectedGroupId.value ? `/groups/${selectedGroupId.value}` : '/groups')
  }
}

function openBill(bill: any) {
  navigateTo(`/groups/${bill.groupId}/bills/${bill.billId}`)
}
</script>

<template>
  <PageShell>
    <HomeScreen
      :health="health"
      :recent-bills="recentBillActivities"
      :summary="homeSummary"
      @nav="handleNav"
      @open-bill="openBill"
    />
  </PageShell>
</template>
