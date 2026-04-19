<script setup lang="ts">
import { computed, watch } from 'vue'
import PageShell from '../../../components/layout/PageShell.vue'
import BillListPanel from '../../../components/ledger/BillListPanel.vue'
import GroupMembersPanel from '../../../components/ledger/GroupMembersPanel.vue'
import GroupSettlementPanel from '../../../components/ledger/GroupSettlementPanel.vue'
import { getGroupIconBackground, getGroupIconLabel } from '../../../../shared/group-icons'

const route = useRoute()
const groupId = computed(() => String(route.params.groupId || ''))

const {
  addPersonToGroup,
  canAddPersonToGroup,
  errorMessage,
  formatCents,
  getGroupById,
  ledgerLoaded,
  personToAddEmail,
  recordSettlementPayment,
  saving,
  selectedGroupBillTransfers,
  selectedGroupSettlementPayments,
  selectedGroupSimplifiedTotalCents,
  selectedGroupSimplifiedTransfers,
  setSelectedGroup,
  undoSettlementPayment,
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
      <div v-if="group" class="section-pad pb-24 pt-6">
        <div class="flex flex-wrap items-start justify-between gap-[14px]">
          <div class="flex items-start gap-[14px]">
            <div
              class="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px] border-[1.5px] border-ink text-[28px] leading-none font-bold text-ink"
              :style="{
                background: getGroupIconBackground(group),
              }"
            >
              {{ getGroupIconLabel(group) }}
            </div>

            <div>
              <NuxtLink class="mono text-[11px] text-muted no-underline" to="/groups">
                ALL GROUPS
              </NuxtLink>
              <h1 class="h-display mt-2.5 text-[40px] leading-none">
                {{ group.name }}
              </h1>
              <div class="mono mt-1.5 text-[11px] text-muted">
                {{ group.memberships.length }} PEOPLE · {{ group.bills.length }} SAVED BILLS
              </div>
            </div>
          </div>

          <NuxtLink class="btn btn-accent no-underline" :to="`/groups/${group.id}/bills/new`">
            New bill
          </NuxtLink>
        </div>

        <div v-if="errorMessage" class="callout-error mt-4">
          {{ errorMessage }}
        </div>

        <div class="home-main mt-[18px] grid gap-[18px]">
          <GroupMembersPanel
            :can-add-person-to-group="canAddPersonToGroup"
            :format-cents="formatCents"
            :group="group"
            :person-to-add-email="personToAddEmail"
            :saving="saving"
            @add-person="addPersonToGroup"
            @update:person-to-add-email="personToAddEmail = $event"
          />

          <div class="grid gap-[18px]">
            <GroupSettlementPanel
              :format-cents="formatCents"
              :payments="selectedGroupSettlementPayments"
              :raw-transfer-count="selectedGroupBillTransfers.length"
              :saving="saving"
              :total-cents="selectedGroupSimplifiedTotalCents"
              :transfers="selectedGroupSimplifiedTransfers"
              @record-payment="recordSettlementPayment"
              @undo-payment="undoSettlementPayment"
            />

            <BillListPanel
              :bills="group.bills"
              :format-cents="formatCents"
              :group-id="group.id"
            />
          </div>
        </div>
      </div>

      <div v-else-if="ledgerLoaded" class="section-pad pt-6">
        <div class="surface-panel p-5">
          <div class="section-label">
            Group not found
          </div>
          <div class="mt-2 text-[15px] leading-[1.5]">
            This route does not match a saved group in the local ledger.
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>
