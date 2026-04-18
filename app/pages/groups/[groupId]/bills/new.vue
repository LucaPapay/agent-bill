<script setup lang="ts">
import { computed, watch } from 'vue'
import PageShell from '../../../../components/layout/PageShell.vue'
import BillComposer from '../../../../components/ledger/BillComposer.vue'

const route = useRoute()
const groupId = computed(() => String(route.params.groupId || ''))
const duplicateBillId = computed(() => String(route.query.duplicate || ''))

const {
  billItems,
  billPaidByPersonId,
  billDate,
  billPreviewShares,
  billRemainingCents,
  billTip,
  billTitle,
  billTotal,
  canCreateBill,
  consumeBillComposerDraft,
  createBill,
  errorMessage,
  formatCents,
  getGroupById,
  ledgerLoaded,
  loadBillFormFromBill,
  removeBillItem,
  resetBillForm,
  resultLayout,
  saving,
  selectedBill,
  selectedGroup,
  setSelectedGroup,
  addBillItem,
  toggleBillItemAssignment,
  updateBillItemAmount,
  updateBillItemName,
} = useLedgerState()

const group = computed(() => getGroupById(groupId.value))

watch([groupId, duplicateBillId], ([nextGroupId, nextDuplicateBillId]) => {
  if (!nextGroupId) {
    return
  }

  setSelectedGroup(nextGroupId)

  if (consumeBillComposerDraft(nextGroupId)) {
    return
  }

  if (nextDuplicateBillId && loadBillFormFromBill(nextGroupId, nextDuplicateBillId, { duplicate: true })) {
    return
  }

  resetBillForm()
}, { immediate: true })

function saveBill() {
  createBill().then((value: any) => {
    if (value?.billId) {
      navigateTo(`/groups/${groupId.value}/bills/${value.billId}`)
    }
  })
}
</script>

<template>
  <PageShell>
    <BillComposer
      v-if="group"
      :bill-items="billItems"
      :bill-paid-by-person-id="billPaidByPersonId"
      :bill-date="billDate"
      :bill-preview-shares="billPreviewShares"
      :bill-remaining-cents="billRemainingCents"
      :bill-tip="billTip"
      :bill-title="billTitle"
      :bill-total="billTotal"
      :can-create-bill="canCreateBill"
      :error-message="errorMessage"
      :format-cents="formatCents"
      :layout="resultLayout"
      :save-label="'Save bill'"
      :saving="saving"
      :selected-bill="selectedBill"
      :selected-group="selectedGroup"
      @add-item="addBillItem"
      @remove-item="removeBillItem"
      @reset="resetBillForm"
      @save="saveBill"
      @toggle-assignment="toggleBillItemAssignment"
      @update:bill-paid-by-person-id="billPaidByPersonId = $event"
      @update:bill-date="billDate = $event"
      @update:bill-tip="billTip = $event"
      @update:bill-title="billTitle = $event"
      @update:bill-total="billTotal = $event"
      @update:item-amount="updateBillItemAmount"
      @update:item-name="updateBillItemName"
      @update:layout="resultLayout = $event"
    />

    <div v-else-if="ledgerLoaded" class="screen">
      <div class="section-pad" style="padding-top: 24px;">
        <div class="surface-panel" style="padding: 20px;">
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
            Group not found
          </div>
          <div style="font-size: 15px; line-height: 1.5; margin-top: 8px;">
            Pick a real group before opening the bill composer.
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>
