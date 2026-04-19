<script setup lang="ts">
import { computed, watch } from 'vue'
import PageShell from '../../../../../components/layout/PageShell.vue'
import BillComposer from '../../../../../components/ledger/BillComposer.vue'

const route = useRoute()
const groupId = computed(() => String(route.params.groupId || ''))
const billId = computed(() => String(route.params.billId || ''))

const {
  addBillItem,
  billItems,
  billPaidByPersonId,
  billDate,
  billPreviewShares,
  billRemainingCents,
  billTip,
  billTitle,
  billTotal,
  canCreateBill,
  errorMessage,
  formatCents,
  getBillById,
  getGroupById,
  ledgerLoaded,
  loadBillFormFromBill,
  removeBillItem,
  saving,
  selectedBill,
  selectedGroup,
  toggleBillItemAssignment,
  updateBill,
  updateBillItemAmount,
  updateBillItemName,
} = useLedgerState()

const group = computed(() => getGroupById(groupId.value))
const bill = computed(() => getBillById(groupId.value, billId.value))
const activeSettlementPaymentCount = computed(() =>
  (group.value?.settlementPayments || []).filter((payment: any) => !payment.isVoided).length,
)
const canUpdateBill = computed(() => canCreateBill.value && activeSettlementPaymentCount.value === 0)
const editErrorMessage = computed(() => {
  if (errorMessage.value) {
    return errorMessage.value
  }

  if (activeSettlementPaymentCount.value > 0) {
    return 'Void active settlement payments before editing this bill.'
  }

  return ''
})

watch([groupId, billId], ([nextGroupId, nextBillId]) => {
  if (nextGroupId && nextBillId) {
    loadBillFormFromBill(nextGroupId, nextBillId)
  }
}, { immediate: true })

function saveBill() {
  if (!billId.value) {
    return
  }

  updateBill(billId.value).then((value: any) => {
    if (value?.billId) {
      navigateTo(`/groups/${groupId.value}/bills/${value.billId}`)
    }
  })
}
</script>

<template>
  <PageShell>
    <BillComposer
      v-if="group && bill"
      :bill-items="billItems"
      :bill-paid-by-person-id="billPaidByPersonId"
      :bill-date="billDate"
      :bill-preview-shares="billPreviewShares"
      :bill-remaining-cents="billRemainingCents"
      :bill-tip="billTip"
      :bill-title="billTitle"
      :bill-total="billTotal"
      :can-create-bill="canUpdateBill"
      :error-message="editErrorMessage"
      :format-cents="formatCents"
      :save-label="'Update bill'"
      :saving="saving"
      :selected-bill="selectedBill"
      :selected-group="selectedGroup"
      @add-item="addBillItem"
      @remove-item="removeBillItem"
      @reset="loadBillFormFromBill(groupId, billId)"
      @save="saveBill"
      @toggle-assignment="toggleBillItemAssignment"
      @update:bill-paid-by-person-id="billPaidByPersonId = $event"
      @update:bill-date="billDate = $event"
      @update:bill-tip="billTip = $event"
      @update:bill-title="billTitle = $event"
      @update:bill-total="billTotal = $event"
      @update:item-amount="updateBillItemAmount"
      @update:item-name="updateBillItemName"
    />

    <div v-else-if="ledgerLoaded" class="screen">
      <div class="section-pad pt-6">
        <div class="surface-panel p-5">
          <div class="section-label">
            Bill not found
          </div>
          <div class="mt-2 text-[15px] leading-[1.5]">
            Pick a real saved bill before opening the editor.
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>
