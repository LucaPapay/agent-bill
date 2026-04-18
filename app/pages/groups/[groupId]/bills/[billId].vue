<script setup lang="ts">
import { computed, watch } from 'vue'
import PageShell from '../../../../components/layout/PageShell.vue'
import BillItemsPanel from '../../../../components/ledger/BillItemsPanel.vue'
import BillListPanel from '../../../../components/ledger/BillListPanel.vue'
import BillReceiptCard from '../../../../components/ledger/BillReceiptCard.vue'
import BillTransfersPanel from '../../../../components/ledger/BillTransfersPanel.vue'
import GroupSettlementPanel from '../../../../components/ledger/GroupSettlementPanel.vue'

const route = useRoute()
const groupId = computed(() => String(route.params.groupId || ''))
const billId = computed(() => String(route.params.billId || ''))

const {
  formatCents,
  getBillById,
  getGroupById,
  ledgerLoaded,
  recordSettlementPayment,
  saving,
  selectedGroupBillTransfers,
  selectedGroupSettlementPayments,
  selectedGroupSimplifiedTotalCents,
  selectedGroupSimplifiedTransfers,
  setSelectedBill,
  undoSettlementPayment,
} = useLedgerState()

const group = computed(() => getGroupById(groupId.value))
const bill = computed(() => getBillById(groupId.value, billId.value))

watch([groupId, billId], ([nextGroupId, nextBillId]) => {
  if (nextGroupId && nextBillId) {
    setSelectedBill(nextGroupId, nextBillId)
  }
}, { immediate: true })
</script>

<template>
  <PageShell>
    <div class="screen" style="align-items: center; justify-content: flex-start; padding-top: 24px;">
      <div v-if="group && bill" class="section-pad" style="width: 100%; padding-bottom: 92px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span class="tape" style="background: var(--mint);">
            Bill detail
          </span>
        </div>

        <BillReceiptCard :bill="bill" :format-cents="formatCents" :group="group" />

        <div style="display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap;">
          <NuxtLink class="btn btn-ghost" style="flex: 1; text-decoration: none;" :to="`/groups/${group.id}`">
            Back to group
          </NuxtLink>
          <NuxtLink class="btn btn-primary" style="flex: 1; text-decoration: none;" :to="`/groups/${group.id}/bills/new`">
            Create another bill
          </NuxtLink>
        </div>

        <div style="display: grid; gap: 14px; margin-top: 18px;" class="home-main">
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
            :selected-bill-id="bill.id"
          />
        </div>

        <div style="display: grid; gap: 14px; margin-top: 18px;" class="profile-grid">
          <BillItemsPanel :bill="bill" :format-cents="formatCents" />
          <BillTransfersPanel :bill="bill" :format-cents="formatCents" />
        </div>
      </div>

      <div v-else-if="ledgerLoaded" class="section-pad" style="width: 100%; padding-top: 24px;">
        <div class="surface-panel" style="padding: 20px;">
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
            Bill not found
          </div>
          <div style="font-size: 15px; line-height: 1.5; margin-top: 8px;">
            This route does not match a saved bill in the selected group.
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>
