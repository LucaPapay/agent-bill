<script setup lang="ts">
import GroupCard from '../../components/app/GroupCard.vue'
import PageShell from '../../components/layout/PageShell.vue'

const { errorMessage, formatCents, createGroup, groupName, ledger, saving } = useLedgerState()

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

function updateGroupName(event: Event) {
  groupName.value = (event.target as HTMLInputElement).value
}

function groupsHeaderLabel() {
  const count = ledger.value.groups.length

  if (!count) {
    return 'Start your first shared tab'
  }

  if (count === 1) {
    return '1 group keeping score'
  }

  return `${count} groups keeping score`
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
              {{ groupsHeaderLabel() }}
            </div>
          </div>

          <NuxtLink class="btn btn-accent" style="text-decoration: none;" to="/scan">
            Scan receipt
          </NuxtLink>
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

        <form
          class="surface-panel"
          style="padding: 16px 18px; text-align: left; display: flex; flex-direction: column; justify-content: space-between; min-height: 170px;"
          @submit.prevent="submitGroup"
        >
          <div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div
                style="width: 52px; height: 52px; border-radius: 16px; background: var(--cream-2); color: var(--ink); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; border: 1.5px dashed rgba(20,18,16,0.35);"
              >
                +
              </div>

              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; font-size: 17px;">
                  Create a new group
                </div>
                <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
                  Start a shared ledger for dinner, travel, or the flat.
                </div>
              </div>
            </div>

            <input
              :value="groupName"
              type="text"
              placeholder="Flat dinner club"
              style="width: 100%; margin-top: 16px; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
              @input="updateGroupName"
            >

            <div
              v-if="errorMessage"
              style="margin-top: 10px; padding: 10px 12px; border-radius: 14px; background: #fff0ec; color: #7d2f21; border: 1px solid rgba(255,84,54,0.2); font-size: 13px; line-height: 1.4;"
            >
              {{ errorMessage }}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: end; gap: 12px; margin-top: 16px;">
            <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em;">
              You join as the first member
            </div>

            <button class="btn btn-accent" style="padding: 10px 16px;" :disabled="saving || !groupName.trim()">
              Create group
            </button>
          </div>
        </form>
      </div>
    </div>
  </PageShell>
</template>
