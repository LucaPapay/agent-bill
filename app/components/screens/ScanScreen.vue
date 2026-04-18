<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'
import BillComposer from '../ledger/BillComposer.vue'
import ReceiptSplitPreview from '../scan/ReceiptSplitPreview.vue'
import { avatarColors, people } from '../app/mockData'
import { useBillAnalysisStream } from '../../composables/useBillAnalysisStream'
import { useLedgerState } from '../../composables/useLedgerState'

const props = defineProps({
  chatId: {
    type: String,
    default: '',
  },
})

const analysis = useBillAnalysisStream()
const ledger = useLedgerState()
const cameraInput = ref(null)
const fileInput = ref(null)
const previewUrl = ref('')
const replyText = ref('')
const selectedFile = ref(null)
const showCameraCapture = ref(false)
const title = ref('Dinner receipt')
const peopleText = ref(people.join(', '))
const composerVisible = ref(false)
const previewOverlayReady = ref(false)
const scrollRef = ref(null)
const {
  addBillItem,
  billItems,
  billPaidByPersonId,
  billPreviewShares,
  billRemainingCents,
  billTip,
  billTitle,
  billTotal,
  canCreateBill,
  createBill,
  errorMessage,
  formatCents,
  ledger: ledgerData,
  removeBillItem,
  resetBillForm,
  resultLayout,
  saving,
  selectedBill,
  selectedGroup,
  selectedGroupId,
  setSelectedGroup,
  toggleBillItemAssignment,
  updateBillItemAmount,
  updateBillItemName,
} = ledger

function getPathChatId() {
  if (typeof window === 'undefined') {
    return ''
  }

  const match = window.location.pathname.match(/^\/scan\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function getResolvedChatId() {
  return String(props.chatId || '').trim() || getPathChatId()
}

const parsedPeople = computed(() =>
  [...new Set(
    peopleText.value
      .split(/[\n,]/)
      .map(value => value.trim())
      .filter(Boolean),
  )],
)

const safeTitle = computed(() => title.value.trim() || 'Untitled bill')
const hasSavedChat = computed(() => Boolean(analysis.chatId.value))
const isRunning = computed(() => ['starting', 'queued', 'extracting', 'agent'].includes(analysis.status.value))
const canPickReceipt = computed(() => parsedPeople.value.length > 0 && !isRunning.value && !hasSavedChat.value)
const extractedReceipt = computed(() => analysis.receipt.value || analysis.result.value?.receipt || null)
const splitRows = computed(() => analysis.result.value?.split || [])
const availableGroups = computed(() => ledgerData.value.groups || [])
const assistantReply = computed(() => analysis.assistantText.value.trim())
const pickerLabel = computed(() => showCameraCapture.value ? 'Use camera' : 'Upload receipt')
const inputModeLabel = computed(() => {
  if (selectedFile.value) {
    return showCameraCapture.value ? 'camera image' : 'image upload'
  }

  if (hasSavedChat.value) {
    return 'saved chat'
  }

  return 'waiting for image'
})
const resolvedTotalCents = computed(() => analysis.result.value?.totalCents || extractedReceipt.value?.totalCents || 0)
const resolvedCurrency = computed(() => extractedReceipt.value?.currency || analysis.result.value?.currency || 'EUR')
const canReply = computed(() => Boolean(splitRows.value.length && extractedReceipt.value && !isRunning.value))
const composerRows = computed(() =>
  splitRows.value.map((row) => ({
    membership: (selectedGroup.value?.memberships || []).find((membership) =>
      membership.person?.name?.trim().toLowerCase() === String(row.person || '').trim().toLowerCase(),
    ) || null,
    row,
  })),
)
const canOpenComposer = computed(() =>
  Boolean(
    selectedGroupId.value
    && splitRows.value.length
    && composerRows.value.every(entry => entry.membership),
  ),
)
const showInlineComposer = computed(() =>
  Boolean(composerVisible.value && canOpenComposer.value && selectedGroup.value),
)
const showFullStagePreview = computed(() => Boolean(previewUrl.value))
const composerMessage = computed(() => {
  if (!splitRows.value.length) {
    return 'Save becomes available once Penny proposes a split.'
  }

  if (!availableGroups.value.length) {
    return 'Create a ledger group first.'
  }

  if (!selectedGroup.value) {
    return 'Create or select a group before handing this split into the ledger.'
  }

  const missingNames = composerRows.value
    .filter(entry => !entry.membership)
    .map(entry => entry.row.person)

  if (missingNames.length) {
    return `The selected group is missing: ${missingNames.join(', ')}.`
  }

  return `This will open the bill composer for ${selectedGroup.value.name}.`
})
const statusLabel = computed(() => {
  if (analysis.loadingChat.value) {
    return 'Loading saved split chat.'
  }

  if (!parsedPeople.value.length) {
    return 'Add at least one person before scanning.'
  }

  if (analysis.status.value === 'starting') {
    return 'Opening the analysis stream.'
  }

  if (analysis.status.value === 'queued') {
    return 'Receipt queued.'
  }

  if (analysis.status.value === 'agent' && !extractedReceipt.value) {
    return 'Penny is reading the receipt.'
  }

  if (analysis.status.value === 'agent') {
    return 'Penny is building the split.'
  }

  if (analysis.status.value === 'complete') {
    return hasSavedChat.value
      ? 'Saved chat ready. Keep revising here or reset to start a new receipt.'
      : 'Split ready.'
  }

  if (analysis.status.value === 'error') {
    return analysis.error.value || 'The scan failed.'
  }

  return 'Upload a receipt image to start the split chat.'
})

function formatMoney(amountCents, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    currency,
    style: 'currency',
  }).format((amountCents || 0) / 100)
}

function formatAmountInput(amountCents) {
  return ((amountCents || 0) / 100).toFixed(2)
}

function personColor(name) {
  return avatarColors[name] || 'rgba(246, 181, 51, 0.3)'
}

function personInitial(name) {
  return String(name || '?').trim().charAt(0).toUpperCase()
}

function revokePreview() {
  if (!previewUrl.value) {
    return
  }

  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

function clearInputs() {
  if (cameraInput.value) {
    cameraInput.value.value = ''
  }

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function setFile(file) {
  revokePreview()
  selectedFile.value = file
  previewOverlayReady.value = false
  previewUrl.value = URL.createObjectURL(file)
}

function resetDraftInputs() {
  replyText.value = ''
  selectedFile.value = null
  title.value = 'Dinner receipt'
  peopleText.value = people.join(', ')
  previewOverlayReady.value = false
  clearInputs()
  revokePreview()
}

function onPreviewAnimationFinished() {
  previewOverlayReady.value = true
}

function openReceiptPicker() {
  if (!canPickReceipt.value) {
    return
  }

  clearInputs()

  if (showCameraCapture.value) {
    cameraInput.value?.click()
    return
  }

  fileInput.value?.click()
}

async function startFileAnalysis(file) {
  await analysis.startFromFile({
    file,
    people: parsedPeople.value,
    title: safeTitle.value,
  })
}

async function hydrateSavedChat(nextChatId) {
  const normalizedChatId = String(nextChatId || '').trim()

  if (!normalizedChatId) {
    return null
  }

  replyText.value = ''
  selectedFile.value = null
  clearInputs()
  revokePreview()

  return await analysis.loadChat(normalizedChatId).then((value) => {
    if (!value) {
      return null
    }

    title.value = value.title || 'Untitled bill'
    peopleText.value = Array.isArray(value.people) ? value.people.join(', ') : ''
    return value
  })
}

function onFileChange(event) {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  setFile(file)
  void startFileAnalysis(file)
}

async function resetScan() {
  resetDraftInputs()
  analysis.reset()

  if (getResolvedChatId()) {
    await navigateTo('/scan')
  }
}

async function submitReply() {
  const message = replyText.value.trim()

  if (!message || !canReply.value) {
    return
  }

  replyText.value = ''
  await analysis.revise(message)
}

function applyComposerDraft() {
  if (!canOpenComposer.value || !selectedGroupId.value) {
    return
  }

  setSelectedGroup(selectedGroupId.value)
  resetBillForm()

  const draftPaidByPersonId = billPaidByPersonId.value && selectedGroup.value?.memberships.some(
    membership => membership.personId === billPaidByPersonId.value,
  )
    ? billPaidByPersonId.value
    : composerRows.value[0]?.membership?.personId || selectedGroup.value?.memberships?.[0]?.personId || ''
  const draftItems = composerRows.value.map((entry, index) => ({
    amount: formatAmountInput(entry.row.amountCents),
    assignedPersonIds: [entry.membership.personId],
    id: `scan-split-${Date.now()}-${index}`,
    name: `${entry.row.person} share`,
  }))

  billTitle.value = safeTitle.value
  billTotal.value = formatAmountInput(resolvedTotalCents.value)
  billTip.value = formatAmountInput(analysis.result.value?.tipCents || extractedReceipt.value?.tipCents || 0)
  billItems.value = draftItems
  billPaidByPersonId.value = draftPaidByPersonId
}

async function openComposer() {
  if (!canOpenComposer.value) {
    return
  }

  applyComposerDraft()
  composerVisible.value = true
  await nextTick()
  document.getElementById('scan-bill-composer')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function saveComposerBill() {
  createBill().then((value) => {
    if (value?.billId && selectedGroupId.value) {
      navigateTo(`/groups/${selectedGroupId.value}/bills/${value.billId}`)
    }
  })
}

function scrollToBottom() {
  nextTick(() => {
    if (!scrollRef.value) {
      return
    }

    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  })
}

watch(
  [
    () => previewUrl.value,
    () => analysis.feed.value.length,
    () => analysis.receipt.value,
    () => analysis.result.value,
    () => analysis.assistantText.value,
  ],
  () => {
    scrollToBottom()
  },
  { deep: true },
)

watch(() => props.chatId, (nextChatId, previousChatId) => {
  const resolvedChatId = String(nextChatId || '').trim() || getPathChatId()

  if (!resolvedChatId) {
    if (previousChatId || analysis.chatId.value || analysis.result.value) {
      resetDraftInputs()
      analysis.reset()
    }

    return
  }

  void hydrateSavedChat(resolvedChatId)
}, { immediate: true })

watch(() => analysis.chatId.value, (nextChatId) => {
  if (!nextChatId || nextChatId === props.chatId) {
    return
  }

  void navigateTo(`/scan/${nextChatId}`, { replace: true })
})

onMounted(() => {
  void ledger.ensureLoaded()
  void hydrateSavedChat(getResolvedChatId())

  showCameraCapture.value =
    window.matchMedia('(pointer: coarse)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
})

onBeforeUnmount(() => {
  revokePreview()
  analysis.stop()
})
</script>

<template>
  <div class="screen scan-chat-screen">
    <div class="section-pad scan-chat-head">
      <div>
        <span class="tape">Split chat</span>
        <h1 class="h-display scan-chat-title">
          Scan and split in one chat.
        </h1>
        <p class="scan-chat-copy">
          Upload a receipt and Penny will parse it, reason through the split, and stream the result here.
        </p>
      </div>

      <div class="scan-chat-meta">
        <div class="chip chip-muted">
          {{ parsedPeople.length }} people
        </div>
        <div class="chip chip-muted">
          {{ resolvedTotalCents ? formatMoney(resolvedTotalCents, resolvedCurrency) : inputModeLabel }}
        </div>
        <div v-if="hasSavedChat" class="chip chip-muted">
          Saved chat
        </div>
      </div>
    </div>

    <div class="section-pad scan-chat-layout">
      <aside class="scan-chat-sidebar">
        <div class="surface-panel scan-setup-card scan-setup-card-primary">
          <div class="scan-sidebar-head">
            <div>
              <div class="scan-panel-kicker">
                Receipt setup
              </div>
              <div class="scan-panel-title">
                Start on the left, chat on the right.
              </div>
            </div>

            <div class="scan-sidebar-dot" />
          </div>

          <label class="scan-field">
            <span class="scan-field-label">Ledger group</span>
            <select
              :value="selectedGroupId"
              class="scan-input"
              @change="setSelectedGroup($event.target.value)"
            >
              <option value="">
                Select group
              </option>
              <option
                v-for="group in availableGroups"
                :key="group.id"
                :value="group.id"
              >
                {{ group.name }} · {{ group.memberships.length }} people
              </option>
            </select>
          </label>

          <label class="scan-field">
            <span class="scan-field-label">Bill title</span>
            <input
              v-model="title"
              type="text"
              placeholder="Friday dinner"
              class="scan-input"
              :disabled="hasSavedChat"
            >
          </label>

          <label class="scan-field">
            <span class="scan-field-label">People</span>
            <textarea
              v-model="peopleText"
              rows="3"
              placeholder="Jojo, Sarah, Miles"
              class="scan-input scan-textarea"
              :disabled="hasSavedChat"
            />
          </label>

          <div v-if="parsedPeople.length" class="scan-person-pills">
            <div
              v-for="person in parsedPeople"
              :key="person"
              class="scan-person-pill"
            >
              <span class="scan-person-pill-avatar" :style="{ background: personColor(person) }">
                {{ personInitial(person) }}
              </span>
              <span>{{ person }}</span>
            </div>
          </div>

          <div class="scan-note scan-status-note">
            <div class="scan-note-label">
              Status
            </div>
            <div class="scan-status-copy">
              {{ statusLabel }}
            </div>
          </div>

          <div v-if="hasSavedChat" class="scan-note">
            <div class="scan-note-label">
              Resume mode
            </div>
            <div>
              This thread is persisted now. Keep revising on the right, or reset here to start a new receipt.
            </div>
          </div>

          <div class="scan-sidebar-actions">
            <button class="btn btn-accent scan-upload-button" :disabled="!canPickReceipt" @click="openReceiptPicker">
              {{ isRunning ? 'Analyzing...' : pickerLabel }}
            </button>

            <button class="scan-link" @click="resetScan">
              Reset
            </button>
          </div>
        </div>

        <div v-if="extractedReceipt" class="surface-panel scan-card">
          <div class="scan-card-head">
            <div>
              <div class="scan-note-label">
                Parsed receipt
              </div>
              <div class="scan-card-title">
                {{ extractedReceipt.merchant || safeTitle }}
              </div>
            </div>
            <div class="scan-card-meta">
              {{ formatMoney(extractedReceipt.totalCents || 0, extractedReceipt.currency || resolvedCurrency) }}
            </div>
          </div>

          <div class="scan-mini-list">
            <div
              v-for="(item, index) in (extractedReceipt.items || []).slice(0, 8)"
              :key="`${item.name}-${index}`"
              class="scan-mini-row"
            >
              <span>{{ item.name }}</span>
              <span>{{ formatMoney(item.amountCents || 0, extractedReceipt.currency || resolvedCurrency) }}</span>
            </div>
          </div>
        </div>
      </aside>

      <section class="scan-chat-main">
        <div class="scan-chat-shell">
          <div class="scan-chat-shell-head">
            <div>
              <div class="scan-panel-kicker scan-panel-kicker-on-dark">
                Split chat
              </div>
              <div class="scan-chat-shell-title">
                Penny reasons here.
              </div>
            </div>

            <div class="scan-chat-shell-meta">
              <div class="scan-shell-chip">
                {{ parsedPeople.length }} people
              </div>
              <div class="scan-shell-chip" :class="analysis.status.value">
                {{ analysis.status.value === 'idle' ? 'Ready' : analysis.status.value }}
              </div>
            </div>
          </div>

          <div
            class="scan-chat-stage"
            :class="{
              'has-preview': showFullStagePreview,
              'overlay-ready': previewOverlayReady,
            }"
          >
            <div v-if="showFullStagePreview" class="scan-chat-preview-stage">
              <ReceiptSplitPreview
                :image-src="previewUrl"
                :status="analysis.status.value"
                :title="safeTitle"
                :total-label="resolvedTotalCents ? formatMoney(resolvedTotalCents, resolvedCurrency) : ''"
                @animation-finished="onPreviewAnimationFinished"
              />
            </div>

            <div
              ref="scrollRef"
              class="chat-stream scan-chat-stream"
              :class="{
                'has-preview': showFullStagePreview,
                'overlay-ready': previewOverlayReady,
              }"
            >
              <div v-if="!previewUrl" class="scan-chat-row">
                <div class="scan-avatar">
                  <IconGlyph name="sparkle" width="16" height="16" />
                </div>
                <div class="scan-bubble assistant">
                  Upload a receipt and I’ll handle the parsing and the first split pass inside this chat.
                </div>
              </div>

              <div v-if="previewUrl" class="scan-chat-row user">
                <div class="scan-bubble user upload">
                  <img
                    :src="previewUrl"
                    alt="Receipt preview"
                    class="scan-upload-image"
                  >
                  <div class="scan-upload-copy">
                    <div class="scan-upload-title">
                      Uploaded receipt
                    </div>
                    <div class="scan-upload-meta">
                      {{ safeTitle }} · {{ parsedPeople.join(', ') }}
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-for="(entry, index) in analysis.feed.value"
                :key="`${entry.text}-${index}`"
                class="scan-chat-row"
                :class="entry.who === 'user' ? 'user' : entry.who === 'penny' ? '' : 'system'"
              >
                <div v-if="entry.who !== 'user'" class="scan-avatar" :class="entry.who === 'penny' ? '' : 'system'">
                  <IconGlyph :name="entry.who === 'penny' ? 'sparkle' : 'scan'" width="16" height="16" />
                </div>
                <div class="scan-bubble" :class="entry.who === 'penny' ? 'assistant' : entry.who === 'user' ? 'user' : 'system'">
                  {{ entry.text }}
                </div>
              </div>

              <div v-if="assistantReply" class="scan-chat-row">
                <div class="scan-avatar">
                  <IconGlyph name="sparkle" width="16" height="16" />
                </div>
                <div class="scan-bubble assistant">
                  {{ assistantReply }}
                </div>
              </div>

              <div v-if="analysis.error.value" class="scan-chat-row system">
                <div class="scan-avatar system">
                  <IconGlyph name="scan" width="16" height="16" />
                </div>
                <div class="scan-bubble system error">
                  {{ analysis.error.value }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="splitRows.length" class="scan-split-board">
            <div class="scan-split-board-head">
              <div>
                <div class="scan-panel-kicker">
                  Final split
                </div>
                <div class="scan-split-board-title">
                  {{ analysis.result.value?.summary }}
                </div>
              </div>
              <div class="scan-split-board-total">
                {{ formatMoney(resolvedTotalCents, resolvedCurrency) }}
              </div>
            </div>

            <div
              v-for="row in splitRows"
              :key="row.person"
              class="scan-split-row"
            >
              <div class="scan-split-person">
                <span class="scan-split-avatar" :style="{ background: personColor(row.person) }">
                  {{ personInitial(row.person) }}
                </span>
                <span>{{ row.person }}</span>
              </div>
              <span class="scan-split-amount">
                {{ formatMoney(row.amountCents || 0, resolvedCurrency) }}
              </span>
            </div>

            <div class="scan-card-actions">
              <button class="btn btn-accent" :disabled="!canOpenComposer" @click="openComposer">
                Open in bill composer
              </button>
              <div class="scan-card-hint scan-card-hint-on-dark">
                {{ composerMessage }}
              </div>
            </div>
          </div>

          <div v-if="!showFullStagePreview || previewOverlayReady" class="scan-chat-composer">
            <form class="scan-reply-form" @submit.prevent="submitReply">
              <input
                v-model="replyText"
                type="text"
                class="scan-input scan-reply-input"
                :disabled="!canReply"
                :placeholder="canReply ? 'Tell Penny what to change about the split' : 'The reply box unlocks after the first split is ready'"
              >
              <button class="btn btn-primary scan-send-button" :disabled="!canReply || !replyText.trim()">
                Send
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>

    <section
      v-if="showInlineComposer"
      id="scan-bill-composer"
      class="scan-inline-composer"
    >
      <div class="scan-inline-composer-head">
        <div>
          <div class="scan-note-label">
            Bill composer
          </div>
          <div class="scan-inline-composer-title">
            Review and save the split in {{ selectedGroup.name }}
          </div>
        </div>
      </div>

      <BillComposer
        :bill-items="billItems"
        :bill-paid-by-person-id="billPaidByPersonId"
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
        @reset="applyComposerDraft"
        @save="saveComposerBill"
        @toggle-assignment="toggleBillItemAssignment"
        @update:bill-paid-by-person-id="billPaidByPersonId = $event"
        @update:bill-tip="billTip = $event"
        @update:bill-title="billTitle = $event"
        @update:bill-total="billTotal = $event"
        @update:item-amount="updateBillItemAmount"
        @update:item-name="updateBillItemName"
        @update:layout="resultLayout = $event"
      />
    </section>

    <input
      ref="cameraInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="scan-hidden-input"
      @change="onFileChange"
    >

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="scan-hidden-input"
      @change="onFileChange"
    >
  </div>
</template>

<style scoped>
.scan-chat-screen {
  display: flex;
  flex-direction: column;
  padding-bottom: 40px;
}

.scan-chat-head {
  padding-top: 18px;
  padding-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.scan-chat-title {
  font-size: clamp(32px, 7vw, 56px);
  line-height: 0.96;
  margin: 10px 0 0;
  max-width: 10ch;
}

.scan-chat-copy {
  margin: 14px 0 0;
  max-width: 44rem;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.6;
}

.scan-chat-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.scan-chat-layout {
  display: grid;
  gap: 18px;
  align-items: start;
}

.scan-chat-sidebar,
.scan-chat-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.scan-setup-card,
.scan-card,
.scan-note {
  border-radius: 28px;
  border: 1px solid rgba(20, 18, 16, 0.08);
  background: rgba(251, 247, 238, 0.92);
  box-shadow: 0 22px 40px rgba(48, 33, 15, 0.07);
}

.scan-setup-card {
  padding: 18px;
}

.scan-setup-card-primary {
  background:
    radial-gradient(circle at top right, rgba(246, 181, 51, 0.2), transparent 34%),
    linear-gradient(180deg, rgba(251, 247, 238, 0.98) 0%, rgba(246, 240, 228, 0.92) 100%);
}

.scan-sidebar-head,
.scan-card-head,
.scan-split-board-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.scan-sidebar-dot {
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: 999px;
  background: var(--tomato);
  box-shadow: 0 0 0 6px rgba(255, 84, 54, 0.14);
}

.scan-panel-kicker,
.scan-field-label,
.scan-note-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.scan-panel-kicker-on-dark {
  color: rgba(246, 240, 228, 0.6);
}

.scan-panel-title,
.scan-card-title {
  margin-top: 6px;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
}

.scan-field {
  display: grid;
  gap: 6px;
}

.scan-field + .scan-field,
.scan-note + .scan-note {
  margin-top: 12px;
}

.scan-input {
  width: 100%;
  border: 1.5px solid rgba(20, 18, 16, 0.12);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.55);
  padding: 13px 14px;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.scan-input:focus {
  border-color: rgba(20, 18, 16, 0.3);
  box-shadow: 0 0 0 4px rgba(246, 181, 51, 0.16);
}

.scan-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.scan-textarea {
  resize: vertical;
  min-height: 112px;
}

.scan-person-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.scan-person-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 6px;
  border-radius: 999px;
  background: rgba(20, 18, 16, 0.05);
  font-size: 12px;
  font-weight: 600;
}

.scan-person-pill-avatar,
.scan-split-avatar {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--ink);
  font-size: 11px;
  font-weight: 700;
}

.scan-note {
  padding: 14px;
}

.scan-status-note {
  margin-top: 14px;
  background: rgba(20, 18, 16, 0.04);
}

.scan-status-copy {
  font-size: 14px;
  line-height: 1.55;
}

.scan-sidebar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
}

.scan-upload-button {
  min-width: 180px;
}

.scan-card {
  padding: 18px;
}

.scan-card-meta {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
}

.scan-mini-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.scan-mini-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(20, 18, 16, 0.08);
  font-size: 13px;
  line-height: 1.45;
}

.scan-mini-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.scan-chat-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 760px;
  border-radius: 32px;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(246, 181, 51, 0.18), transparent 34%),
    linear-gradient(180deg, #17130f 0%, #0e0c0a 100%);
  border: 1px solid rgba(20, 18, 16, 0.18);
  box-shadow: 0 34px 70px rgba(31, 22, 11, 0.22);
}

.scan-chat-shell-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  padding: 20px 22px 16px;
  border-bottom: 1px solid rgba(246, 240, 228, 0.08);
}

.scan-chat-shell-title {
  margin-top: 6px;
  color: var(--cream);
  font-size: 22px;
  font-weight: 700;
}

.scan-chat-shell-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.scan-shell-chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(246, 240, 228, 0.08);
  color: var(--cream);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.scan-shell-chip.complete {
  background: rgba(143, 197, 106, 0.18);
  color: #c9efad;
}

.scan-shell-chip.error {
  background: rgba(255, 84, 54, 0.18);
  color: #ffc1b5;
}

.scan-shell-chip.starting,
.scan-shell-chip.queued,
.scan-shell-chip.extracting,
.scan-shell-chip.agent {
  background: rgba(246, 181, 51, 0.16);
  color: #ffe0a3;
}

.scan-chat-stream {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-width: 0;
  padding: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 22%),
    transparent;
}

.scan-chat-stage {
  position: relative;
  flex: 1;
  min-height: 520px;
}

.scan-chat-preview-stage {
  position: absolute;
  inset: 0;
  z-index: 1;
  transition:
    filter 240ms ease,
    transform 240ms ease;
}

.scan-chat-preview-stage :deep(.receipt-split-stage) {
  min-height: 100%;
  height: 100%;
}

.scan-chat-stream.has-preview {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow-y: auto;
  overscroll-behavior: contain;
  opacity: 0;
  pointer-events: none;
  transform: translateY(24px);
  overflow-x: hidden;
  transition:
    opacity 220ms ease,
    transform 260ms ease;
}

.scan-chat-stream.has-preview::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  backdrop-filter: blur(18px) saturate(0.72);
  background:
    linear-gradient(180deg, rgba(7, 8, 10, 0.26) 0%, rgba(7, 8, 10, 0.36) 24%, rgba(7, 8, 10, 0.58) 100%),
    radial-gradient(circle at top center, rgba(129, 170, 219, 0.12), transparent 44%);
}

.scan-chat-stream.has-preview > * {
  position: relative;
  z-index: 1;
}

.scan-chat-stream.has-preview.overlay-ready {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.scan-chat-stage.has-preview.overlay-ready .scan-chat-preview-stage {
  filter: blur(3px) saturate(0.7) brightness(0.5);
  transform: scale(1.015);
}

.scan-chat-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.scan-chat-row.user {
  justify-content: flex-end;
}

.scan-avatar {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: rgba(246, 181, 51, 0.18);
  color: var(--marigold);
  border: 1px solid rgba(246, 181, 51, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.scan-avatar.system {
  background: rgba(246, 240, 228, 0.08);
  color: rgba(246, 240, 228, 0.72);
  border-color: rgba(246, 240, 228, 0.12);
}

.scan-bubble {
  max-width: min(100%, 34rem);
  border-radius: 22px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.5;
}

.scan-bubble.assistant {
  background: var(--paper);
  color: var(--ink);
  border-bottom-left-radius: 8px;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.12);
}

.scan-bubble.system {
  background: rgba(246, 240, 228, 0.09);
  color: rgba(246, 240, 228, 0.82);
  border: 1px solid rgba(246, 240, 228, 0.1);
}

.scan-bubble.error {
  background: rgba(255, 84, 54, 0.18);
  border-color: rgba(255, 84, 54, 0.26);
  color: #ffd0c8;
}

.scan-bubble.user {
  background: var(--tomato);
  color: var(--cream);
  border: none;
  box-shadow: 0 16px 28px rgba(255, 84, 54, 0.26);
}

.scan-bubble.upload {
  display: grid;
  gap: 12px;
  width: min(100%, 20rem);
}

.scan-upload-image {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border-radius: 14px;
}

.scan-upload-title {
  font-weight: 700;
}

.scan-upload-meta {
  font-size: 12px;
  color: rgba(246, 240, 228, 0.78);
  line-height: 1.5;
}

.scan-card-actions {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.scan-card-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}

.scan-card-hint-on-dark {
  color: rgba(246, 240, 228, 0.64);
}

.scan-split-board {
  margin: 0 22px 0;
  padding: 18px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(246, 181, 51, 0.18), transparent 35%),
    rgba(251, 247, 238, 0.96);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.16);
}

.scan-split-board-title {
  margin-top: 6px;
  font-size: 20px;
  line-height: 1.25;
  font-weight: 700;
}

.scan-split-board-total {
  font-family: var(--display);
  font-size: clamp(36px, 5vw, 52px);
  line-height: 0.9;
}

.scan-split-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(20, 18, 16, 0.08);
}

.scan-split-row:first-of-type {
  margin-top: 12px;
}

.scan-split-row:last-of-type {
  border-bottom: none;
}

.scan-split-person {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
}

.scan-split-amount {
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 700;
}

.scan-inline-composer {
  margin: 12px 16px 0;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(20, 18, 16, 0.08);
  background: rgba(255, 255, 255, 0.45);
}

.scan-inline-composer-head {
  padding: 18px 18px 0;
}

.scan-inline-composer-title {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
}

.scan-chat-composer {
  position: sticky;
  bottom: 0;
  padding: 18px 22px 22px;
  background: linear-gradient(to bottom, rgba(14, 12, 10, 0), rgba(14, 12, 10, 0.9) 28%, #0e0c0a 100%);
}

.scan-reply-form {
  display: flex;
  gap: 10px;
  align-items: center;
}

.scan-reply-input {
  flex: 1;
  min-width: 0;
  border-color: rgba(246, 240, 228, 0.12);
  background: rgba(246, 240, 228, 0.08);
  color: var(--cream);
}

.scan-reply-input::placeholder {
  color: rgba(246, 240, 228, 0.46);
}

.scan-hidden-input {
  display: none;
}

.scan-send-button {
  flex-shrink: 0;
}

.scan-link {
  font-size: 12px;
  font-weight: 700;
  color: var(--tomato);
}

@media (min-width: 980px) {
  .scan-chat-head {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
  }

  .scan-chat-meta {
    justify-content: flex-end;
  }

  .scan-chat-layout {
    grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
    align-items: start;
  }

  .scan-chat-main {
    min-height: calc(100vh - 220px);
  }

  .scan-chat-sidebar {
    position: sticky;
    top: 16px;
  }

  .scan-chat-shell {
    min-height: calc(100vh - 220px);
  }

  .scan-chat-stream {
    max-height: calc(100vh - 470px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .scan-chat-stream::-webkit-scrollbar {
    width: 8px;
  }

  .scan-chat-stream::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(246, 240, 228, 0.16);
  }

  .scan-card-actions {
    grid-template-columns: auto 1fr;
    align-items: center;
  }
}

@media (max-width: 640px) {
  .scan-chat-head {
    padding-bottom: 14px;
  }

  .scan-card,
  .scan-setup-card {
    padding: 16px;
  }

  .scan-chat-shell-head {
    flex-direction: column;
  }

  .scan-chat-shell-meta {
    justify-content: flex-start;
  }

  .scan-chat-stage {
    min-height: 460px;
  }

  .scan-chat-stream.has-preview {
    padding: 16px;
  }

  .scan-split-board {
    margin-left: 16px;
    margin-right: 16px;
  }

  .scan-reply-form,
  .scan-sidebar-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
