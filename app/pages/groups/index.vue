<script setup lang="ts">
import GroupCard from '../../components/app/GroupCard.vue'
import PageShell from '../../components/layout/PageShell.vue'
import { getGroupIconBackground, getGroupIconLabel } from '../../../shared/group-icons'

const {
  createGroup,
  errorMessage,
  formatCents,
  groupName,
  ledger,
  saving,
} = useLedgerState()

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
      <div class="section-pad pb-4 pt-2">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="h-display m-0 text-[42px] leading-none">
              Groups
            </h1>
            <div class="mono mt-1.5 text-[11px] text-muted">
              {{ groupsHeaderLabel() }}
            </div>
          </div>

          <NuxtLink class="btn btn-accent no-underline" to="/scan">
            Scan receipt
          </NuxtLink>
        </div>
      </div>

      <div class="section-pad groups-grid pb-24">
        <GroupCard
          v-for="group in ledger.groups"
          :key="group.id"
          :amount-label="groupOpenAmount(group)"
          :avatar-names="groupMemberNames(group)"
          :icon-background="getGroupIconBackground(group)"
          :icon-label="getGroupIconLabel(group)"
          :subtitle="`${group.bills.length} bills · ${group.memberships.length} people`"
          :title="group.name"
          @select="openGroup(group.id)"
        />

        <form
          class="surface-panel self-start px-[18px] py-4 text-left"
          @submit.prevent="submitGroup"
        >
          <div class="grid gap-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border-[1.5px] border-dashed border-black/35 bg-cream-2 text-2xl font-bold text-ink"
              >
                AI
              </div>

              <div class="min-w-0 flex-1">
                <div class="text-[17px] font-bold">
                  Create a new group
                </div>
                <div class="mt-0.5 max-w-[36ch] text-xs text-muted">
                  Start a shared ledger for dinner, travel, or the flat. Penny picks the icon and background color.
                </div>
              </div>
            </div>

            <input
              :value="groupName"
              type="text"
              placeholder="Flat dinner club"
              class="form-input mt-4"
              @input="updateGroupName"
            >

            <div
              v-if="errorMessage"
              class="callout-error mt-2.5 rounded-[14px] px-3 py-2.5"
            >
              {{ errorMessage }}
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="mono text-[11px] uppercase tracking-[0.08em] text-muted">
              You join as the first member
              </div>

              <button class="btn btn-accent btn-sm" :disabled="saving || !groupName.trim()">
                Create group
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </PageShell>
</template>
