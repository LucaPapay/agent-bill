<script setup lang="ts">
import GroupCard from '../../components/app/GroupCard.vue'
import PageShell from '../../components/layout/PageShell.vue'
import CreateGroupForm from '../../components/ledger/CreateGroupForm.vue'
import CreatePersonForm from '../../components/ledger/CreatePersonForm.vue'

const { errorMessage, formatCents, createGroup, createPerson, groupName, ledger, personName, saving } = useLedgerState()

function groupOpenAmount(group: any) {
  const cents = (group.simplifiedTransfers || []).reduce((sum: number, transfer: any) => sum + transfer.amountCents, 0)

  if (!cents) {
    return 'Settled'
  }

  return `${formatCents(cents)} open`
}

function groupMemberNames(group: any) {
  return (group.memberships || []).map((membership: any) => membership.person.name)
}

function openGroup(groupId: string) {
  navigateTo(`/groups/${groupId}`)
}

function submitGroup() {
  createGroup().then((value: any) => {
    if (value?.groupId) {
      navigateTo(`/groups/${value.groupId}`)
    }
  })
}
</script>

<template>
  <PageShell>
    <div class="screen">
      <div class="section-pad" style="padding-top: 8px; padding-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div>
            <h1 class="h-display" style="font-size: 42px; line-height: 1; margin: 0;">
              Groups
            </h1>
            <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 6px;">
              {{ ledger.groups.length }} ACTIVE · REAL ROUTES
            </div>
          </div>

          <NuxtLink class="btn btn-accent" style="text-decoration: none;" to="/scan">
            Scan receipt
          </NuxtLink>
        </div>
      </div>

      <div class="section-pad" style="display: grid; gap: 12px; margin-bottom: 16px;">
        <div style="display: grid; gap: 12px;" class="profile-grid">
          <CreatePersonForm
            :person-name="personName"
            :saving="saving"
            @submit="createPerson"
            @update:person-name="personName = $event"
          />

          <CreateGroupForm
            :group-name="groupName"
            :saving="saving"
            @submit="submitGroup"
            @update:group-name="groupName = $event"
          />
        </div>

        <div v-if="errorMessage" style="padding: 12px 14px; border-radius: 16px; background: #fff0ec; color: #7d2f21; border: 1px solid rgba(255,84,54,0.2); font-size: 13px;">
          {{ errorMessage }}
        </div>
      </div>

      <div class="section-pad groups-grid" style="padding-bottom: 96px;">
        <GroupCard
          v-for="group in ledger.groups"
          :key="group.id"
          :amount-label="groupOpenAmount(group)"
          :avatar-names="groupMemberNames(group)"
          :icon-label="group.name.charAt(0).toUpperCase()"
          :subtitle="`${group.bills.length} bills · ${group.memberships.length} people`"
          :title="group.name"
          @select="openGroup(group.id)"
        />
      </div>
    </div>
  </PageShell>
</template>
