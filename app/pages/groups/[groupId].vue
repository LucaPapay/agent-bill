<script setup lang="ts">
import { computed, watch } from 'vue'
import PageShell from '../../components/layout/PageShell.vue'
import BillListPanel from '../../components/ledger/BillListPanel.vue'
import GroupMembersPanel from '../../components/ledger/GroupMembersPanel.vue'
import GroupSettlementPanel from '../../components/ledger/GroupSettlementPanel.vue'

const route = useRoute()
const groupId = computed(() => String(route.params.groupId || ''))

const {
  addPersonToGroup,
  canAddPersonToGroup,
  errorMessage,
  formatCents,
  getGroupById,
  ledgerLoaded,
  peopleNotInSelectedGroup,
  personToAddId,
  saving,
  selectedGroupBillTransfers,
  selectedGroupSimplifiedTotalCents,
  selectedGroupSimplifiedTransfers,
  setSelectedGroup,
} = useLedgerState()

const group = computed(() => getGroupById(groupId.value))

watch(groupId, (value) => {
  if (value) {
    setSelectedGroup(value)
  }
}, { immediate: true })
</script>

<template>
  <PageShell>
    <div class="screen">
      <div v-if="group" class="section-pad" style="padding-top: 24px; padding-bottom: 96px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
          <div>
            <NuxtLink class="mono" style="font-size: 11px; color: var(--muted); text-decoration: none;" to="/groups">
              ALL GROUPS
            </NuxtLink>
            <h1 class="h-display" style="font-size: 40px; line-height: 1; margin: 10px 0 0;">
              {{ group.name }}
            </h1>
            <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 6px;">
              {{ group.memberships.length }} PEOPLE · {{ group.bills.length }} SAVED BILLS
            </div>
          </div>

          <NuxtLink class="btn btn-accent" style="text-decoration: none;" :to="`/groups/${group.id}/bills/new`">
            New bill
          </NuxtLink>
        </div>

        <div v-if="errorMessage" style="margin-top: 16px; padding: 12px 14px; border-radius: 16px; background: #fff0ec; color: #7d2f21; border: 1px solid rgba(255,84,54,0.2); font-size: 13px;">
          {{ errorMessage }}
        </div>

        <div style="display: grid; gap: 18px; margin-top: 18px;" class="home-main">
          <GroupMembersPanel
            :can-add-person-to-group="canAddPersonToGroup"
            :group="group"
            :people-not-in-selected-group="peopleNotInSelectedGroup"
            :person-to-add-id="personToAddId"
            :saving="saving"
            @add-person="addPersonToGroup"
            @update:person-to-add-id="personToAddId = $event"
          />

          <div style="display: grid; gap: 18px;">
            <GroupSettlementPanel
              :format-cents="formatCents"
              :raw-transfer-count="selectedGroupBillTransfers.length"
              :total-cents="selectedGroupSimplifiedTotalCents"
              :transfers="selectedGroupSimplifiedTransfers"
            />

            <BillListPanel
              :bills="group.bills"
              :format-cents="formatCents"
              :group-id="group.id"
            />
          </div>
        </div>
      </div>

      <div v-else-if="ledgerLoaded" class="section-pad" style="padding-top: 24px;">
        <div class="surface-panel" style="padding: 20px;">
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
            Group not found
          </div>
          <div style="font-size: 15px; line-height: 1.5; margin-top: 8px;">
            This route does not match a saved group in the local ledger.
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>
