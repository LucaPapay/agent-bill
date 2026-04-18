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
    <div class="screen" style="align-items: center; justify-content: flex-start; padding-top: 24px;">
      <div v-if="group && bill" class="section-pad" style="width: 100%; padding-bottom: 92px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span class="tape" style="background: var(--mint);">
            Bill detail
          </span>
        </div>

        <div style="max-width: 960px; width: 100%; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
          <NuxtLink
            class="chip chip-muted chip-action"
            :style="{ textDecoration: 'none', opacity: canMutateBill ? 1 : 0.45, pointerEvents: canMutateBill ? 'auto' : 'none' }"
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
          style="max-width: 960px; margin: 12px auto 0; padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px; line-height: 1.45;"
        >
          Active settlement payments exist in this group, so editing and deleting this bill stay locked until those payments are undone.
        </div>

        <div style="max-width: 1120px; width: 100%; margin: 18px auto 0; display: grid; gap: 14px;" class="profile-grid">
          <BillItemsPanel :bill="bill" :format-cents="formatCents" />
          <BillTransfersPanel :bill="bill" :format-cents="formatCents" />
        </div>

        <div style="max-width: 960px; width: 100%; margin: 18px auto 0;">
          <BillListPanel
            :bills="group.bills"
            :format-cents="formatCents"
            :group-id="group.id"
            :selected-bill-id="bill.id"
          />
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
