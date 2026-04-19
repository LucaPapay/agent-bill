<script setup lang="ts">
import { computed, watch } from 'vue'
import PageShell from '../../../../../components/layout/PageShell.vue'
import BillItemsPanel from '../../../../../components/ledger/BillItemsPanel.vue'
import BillListPanel from '../../../../../components/ledger/BillListPanel.vue'
import BillReceiptCard from '../../../../../components/ledger/BillReceiptCard.vue'
import BillTransfersPanel from '../../../../../components/ledger/BillTransfersPanel.vue'

const route = useRoute()
const groupId = computed(() => String(route.params.groupId || ''))
const billId = computed(() => String(route.params.billId || ''))

const {
  deleteBill,
  formatCents,
  getBillById,
  getGroupById,
  ledgerLoaded,
  saving,
  setSelectedBill,
} = useLedgerState()

const group = computed(() => getGroupById(groupId.value))
const bill = computed(() => getBillById(groupId.value, billId.value))
const activeSettlementPaymentCount = computed(() =>
  (group.value?.settlementPayments || []).filter((payment: any) => !payment.isVoided).length,
)
const canMutateBill = computed(() => activeSettlementPaymentCount.value === 0)

watch([groupId, billId], ([nextGroupId, nextBillId]) => {
  if (nextGroupId && nextBillId) {
    setSelectedBill(nextGroupId, nextBillId)
  }
}, { immediate: true })

function removeBill() {
  if (!bill.value || !group.value || !window.confirm(`Delete "${bill.value.title}"?`)) {
    return
  }

  deleteBill(bill.value.id).then((value: any) => {
    if (value?.groupId) {
      navigateTo(`/groups/${value.groupId}`)
    }
  })
}
</script>

<template>
  <PageShell>
    <div class="screen items-center justify-start pt-6">
      <div v-if="group && bill" class="section-pad w-full pb-[92px]">
        <div class="mb-5 text-center">
          <span class="tape" style="background: var(--mint);">
            Bill detail
          </span>
        </div>

        <div class="mx-auto mb-3 flex w-full max-w-[960px] flex-wrap justify-end gap-2">
          <NuxtLink
            class="chip chip-muted chip-action"
            :class="canMutateBill ? 'pointer-events-auto opacity-100 no-underline' : 'pointer-events-none opacity-[0.45] no-underline'"
            :to="`/groups/${group.id}/bills/${bill.id}/edit`"
          >
            Edit bill
          </NuxtLink>
          <button
            class="chip chip-action"
            :disabled="saving || !canMutateBill"
            style="background: rgba(255, 84, 54, 0.14); color: #8f2e1f;"
            @click="removeBill"
          >
            Delete bill
          </button>
        </div>

        <BillReceiptCard :bill="bill" :format-cents="formatCents" :group="group" />

        <div
          v-if="!canMutateBill"
          class="mx-auto mt-3 max-w-[960px] rounded-2xl bg-paper px-[14px] py-3 text-[13px] leading-[1.45]"
        >
          Active settlement payments exist in this group, so editing and deleting this bill stay locked until those payments are undone.
        </div>

        <div class="profile-grid mx-auto mt-[18px] grid w-full max-w-[1120px] gap-[14px]">
          <BillItemsPanel :bill="bill" :format-cents="formatCents" />
          <BillTransfersPanel :bill="bill" :format-cents="formatCents" />
        </div>

        <div class="mx-auto mt-[18px] w-full max-w-[960px]">
          <BillListPanel
            :bills="group.bills"
            :format-cents="formatCents"
            :group-id="group.id"
            :selected-bill-id="bill.id"
          />
        </div>
      </div>

      <div v-else-if="ledgerLoaded" class="section-pad w-full pt-6">
        <div class="surface-panel p-5">
          <div class="section-label">
            Bill not found
          </div>
          <div class="mt-2 text-[15px] leading-[1.5]">
            This route does not match a saved bill in the selected group.
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>
