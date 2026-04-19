<script setup lang="ts">
import { computed, watch } from 'vue'
import PageShell from '../../../../components/layout/PageShell.vue'
import BillComposer from '../../../../components/ledger/BillComposer.vue'

const route = useRoute()
const pennyChat = usePennyChat()
const groupId = computed(() => String(route.params.groupId || ''))
const sourceChatId = computed(() => String(route.query.chatId || '').trim())
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
  loadBillFormFromChat,
  removeBillItem,
  resetBillForm,
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

watch([ledgerLoaded, groupId, sourceChatId, duplicateBillId], async ([loaded, nextGroupId, nextSourceChatId, nextDuplicateBillId]) => {
  if (!loaded || !nextGroupId) {
    return
  }

  setSelectedGroup(nextGroupId)

  if (consumeBillComposerDraft(nextGroupId)) {
    return
  }

  if (nextSourceChatId && await loadBillFormFromChat(nextGroupId, nextSourceChatId)) {
    return
  }

  if (nextDuplicateBillId && loadBillFormFromBill(nextGroupId, nextDuplicateBillId, { duplicate: true })) {
    return
  }

  resetBillForm()
}, { immediate: true })

async function saveBill() {
  const value = await createBill()

  if (!value?.billId) {
    return
  }

  if (sourceChatId.value) {
    await pennyChat.loadChat(sourceChatId.value, { force: true })
  }

  await navigateTo(`/groups/${groupId.value}/bills/${value.billId}`)
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
    />

    <div v-else-if="ledgerLoaded" class="screen">
      <div class="section-pad pt-6">
        <div class="surface-panel p-5">
          <div class="section-label">
            Group not found
          </div>
          <div class="mt-2 text-[15px] leading-[1.5]">
            Pick a real group before opening the bill composer.
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>
