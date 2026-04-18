<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'
import ReceiptSplitPreview from '../scan/ReceiptSplitPreview.vue'
import { people } from '../app/mockData'
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
const scrollRef = ref(null)
const {
  billItems,
  billPaidByPersonId,
  billTip,
  billTitle,
  billTotal,
  resetBillForm,
  selectedGroup,
  selectedGroupId,
  setSelectedGroup,
} = ledger

const parsedPeople = computed(() =>
  [...new Set(
    peopleText.value
      .split(/[\n,]/)
      .map(value => value.trim())
      .filter(Boolean),
  )],
)

const safeTitle = computed(() => title.value.trim() || 'Untitled bill')
const currentChatId = computed(() => analysis.chatId.value || '')
const hasSavedChat = computed(() => Boolean(currentChatId.value))
const isRunning = computed(() => ['starting', 'queued', 'extracting', 'agent'].includes(analysis.status.value))
const canPickReceipt = computed(() => parsedPeople.value.length > 0 && !isRunning.value && !hasSavedChat.value)
const extractedReceipt = computed(() => analysis.receipt.value || analysis.result.value?.receipt || null)
const splitRows = computed(() => analysis.result.value?.split || [])
const assistantReply = computed(() => analysis.assistantText.value.trim())
const pickerLabel = computed(() => showCameraCapture.value ? 'Use camera' : 'Upload receipt')
const recentChats = computed(() => analysis.recentChats.value || [])
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
const composerMessage = computed(() => {
  if (!splitRows.value.length) {
    return 'Save becomes available once Penny proposes a split.'
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
  previewUrl.value = URL.createObjectURL(file)
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

function onFileChange(event) {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  setFile(file)
  void startFileAnalysis(file)
}

async function resetScan() {
  replyText.value = ''
  selectedFile.value = null
  analysis.reset()
  clearInputs()
  revokePreview()

  if (props.chatId) {
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

async function openSavedChat(nextChatId) {
  await navigateTo(`/scan/${nextChatId}`)
}

async function openComposer() {
  if (!canOpenComposer.value || !selectedGroupId.value) {
    return
  }

  setSelectedGroup(selectedGroupId.value)
  resetBillForm()

  billTitle.value = safeTitle.value
  billTotal.value = formatAmountInput(resolvedTotalCents.value)
  billTip.value = formatAmountInput(analysis.result.value?.tipCents || extractedReceipt.value?.tipCents || 0)
  billItems.value = composerRows.value.map((entry, index) => ({
    amount: formatAmountInput(entry.row.amountCents),
    assignedPersonIds: [entry.membership.personId],
    id: `scan-split-${Date.now()}-${index}`,
    name: `${entry.row.person} share`,
  }))
  billPaidByPersonId.value = billPaidByPersonId.value && selectedGroup.value?.memberships.some(
    membership => membership.personId === billPaidByPersonId.value,
  )
    ? billPaidByPersonId.value
    : composerRows.value[0]?.membership?.personId || selectedGroup.value?.memberships?.[0]?.personId || ''

  await navigateTo(`/groups/${selectedGroupId.value}/bills/new`)
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
  if (!nextChatId) {
    if (previousChatId) {
      void resetScan()
    }

    return
  }

  replyText.value = ''
  selectedFile.value = null
  clearInputs()
  revokePreview()

  analysis.loadChat(nextChatId).then((value) => {
    if (!value) {
      return
    }

    title.value = value.title || 'Untitled bill'
    peopleText.value = Array.isArray(value.people) ? value.people.join(', ') : ''
  })
}, { immediate: true })

watch(() => analysis.chatId.value, (nextChatId) => {
  if (!nextChatId || nextChatId === props.chatId) {
    return
  }

  void navigateTo(`/scan/${nextChatId}`, { replace: true })
})

onMounted(() => {
  void analysis.loadChats()

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

    <div ref="scrollRef" class="chat-stream scan-chat-stream">
      <div class="scan-chat-row">
        <div class="scan-avatar">
          <IconGlyph name="sparkle" width="16" height="16" />
        </div>
        <div class="scan-bubble assistant">
          Upload a receipt and I’ll handle the parsing and the first split pass inside this chat.
        </div>
      </div>

      <div class="scan-setup-card">
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
            rows="2"
            placeholder="Jojo, Sarah, Miles"
            class="scan-input scan-textarea"
            :disabled="hasSavedChat"
          />
        </label>

        <div class="scan-note">
          <div class="scan-note-label">
            Status
          </div>
          <div>{{ statusLabel }}</div>
        </div>

        <div v-if="hasSavedChat" class="scan-note">
          <div class="scan-note-label">
            Resume mode
          </div>
          <div>
            This thread is now persisted. Keep using the reply box to adapt the split, or reset to start a new receipt.
          </div>
        </div>
      </div>

      <div v-if="recentChats.length" class="scan-card scan-history-card">
        <div class="scan-card-head">
          <div>
            <div class="scan-note-label">
              Recent chats
            </div>
            <div class="scan-card-title">
              Resume a saved split
            </div>
          </div>
        </div>

        <div class="scan-history-list">
          <button
            v-for="chat in recentChats"
            :key="chat.chatId"
            class="scan-history-item"
            :class="{ active: chat.chatId === currentChatId }"
            @click="openSavedChat(chat.chatId)"
          >
            <div>
              <div class="scan-history-title">
                {{ chat.title }}
              </div>
              <div class="scan-history-meta">
                {{ chat.people.join(', ') || 'No people saved' }}
              </div>
            </div>
            <div class="scan-history-side">
              <div class="scan-history-amount">
                {{ formatMoney(chat.totalCents || 0) }}
              </div>
              <div class="scan-history-summary">
                {{ chat.summary || 'Open saved split' }}
              </div>
            </div>
          </button>
        </div>
      </div>

      <div class="scan-card scan-history-card">
        <div class="scan-card-head">
          <div>
            <div class="scan-note-label">
              Receipt preview
            </div>
            <div class="scan-card-title">
              {{ previewUrl ? safeTitle : 'Scan a real receipt' }}
            </div>
          </div>
        </div>

        <div style="margin-top: 12px;">
          <ReceiptSplitPreview
            v-if="previewUrl"
            :image-src="previewUrl"
            :status="analysis.status.value"
            :title="safeTitle"
            :total-label="resolvedTotalCents ? formatMoney(resolvedTotalCents, resolvedCurrency) : ''"
          />

          <div v-else class="scan-note">
            Use the camera on mobile. Everywhere else, upload an image file.
          </div>
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

      <div v-if="extractedReceipt" class="scan-card receipt">
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

      <div v-if="splitRows.length" class="scan-card split">
        <div class="scan-card-head">
          <div>
            <div class="scan-note-label">
              Final split
            </div>
            <div class="scan-card-title">
              {{ analysis.result.value?.summary }}
            </div>
          </div>
        </div>

        <div class="scan-mini-list">
          <div
            v-for="row in splitRows"
            :key="row.person"
            class="scan-mini-row"
          >
            <span>{{ row.person }}</span>
            <span>{{ formatMoney(row.amountCents || 0, resolvedCurrency) }}</span>
          </div>
        </div>

        <div class="scan-card-actions">
          <button class="btn btn-ghost" :disabled="!canOpenComposer" @click="openComposer">
            Open in bill composer
          </button>
          <div class="scan-card-hint">
            {{ composerMessage }}
          </div>
        </div>
      </div>

      <div v-if="analysis.error.value" class="scan-card error">
        {{ analysis.error.value }}
      </div>
    </div>

    <div class="scan-chat-composer">
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

      <div class="scan-composer-stack">
        <form class="scan-reply-form" @submit.prevent="submitReply">
          <input
            v-model="replyText"
            type="text"
            class="scan-input scan-reply-input"
            :disabled="!canReply"
            :placeholder="canReply ? 'Tell Penny what to change about the split' : 'The reply box unlocks after the first split is ready'"
          >
          <button class="btn btn-accent" :disabled="!canReply || !replyText.trim()">
            Send
          </button>
        </form>

        <div class="scan-composer-actions">
          <button class="btn btn-primary" :disabled="!canPickReceipt" @click="openReceiptPicker">
            {{ isRunning ? 'Analyzing...' : pickerLabel }}
          </button>

          <button class="scan-link" @click="resetScan">
            Reset
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scan-chat-screen {
  display: flex;
  flex-direction: column;
  padding-bottom: 0;
}

.scan-chat-head {
  padding-top: 14px;
  padding-bottom: 14px;
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
  max-width: 40rem;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.6;
}

.scan-chat-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.scan-chat-stream {
  padding: 0 16px 120px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: var(--ink);
  color: var(--marigold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.scan-avatar.system {
  background: rgba(20, 18, 16, 0.08);
  color: var(--ink);
}

.scan-bubble {
  max-width: min(100%, 34rem);
  border-radius: 20px;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.5;
}

.scan-bubble.assistant {
  background: var(--ink);
  color: var(--cream);
  border-bottom-left-radius: 6px;
}

.scan-bubble.system {
  background: rgba(20, 18, 16, 0.06);
  color: var(--ink);
}

.scan-bubble.user {
  background: var(--paper);
  color: var(--ink);
  border: 1.5px solid rgba(20, 18, 16, 0.12);
}

.scan-bubble.upload {
  display: grid;
  gap: 10px;
  width: min(100%, 18rem);
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
  color: var(--muted);
  line-height: 1.5;
}

.scan-setup-card,
.scan-card,
.scan-note {
  border-radius: 20px;
  padding: 14px;
  background: var(--paper);
  border: 1px solid rgba(20, 18, 16, 0.08);
}

.scan-field {
  display: grid;
  gap: 6px;
}

.scan-field + .scan-field {
  margin-top: 12px;
}

.scan-field-label,
.scan-note-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.scan-input {
  width: 100%;
  border: 1.5px solid rgba(20, 18, 16, 0.12);
  border-radius: 18px;
  background: var(--paper);
  padding: 12px 14px;
  outline: none;
}

.scan-textarea {
  resize: vertical;
  min-height: 92px;
}

.scan-note {
  margin-top: 12px;
}

.scan-card.receipt,
.scan-card.split,
.scan-card.error {
  margin-left: 40px;
}

.scan-history-card {
  margin-left: 40px;
}

.scan-card.error {
  background: rgba(255, 84, 54, 0.12);
  border-color: rgba(255, 84, 54, 0.25);
  color: #8f2a16;
  font-weight: 600;
}

.scan-card-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.scan-card-title {
  margin-top: 6px;
  font-size: 18px;
  line-height: 1.3;
  font-weight: 700;
}

.scan-card-meta {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
}

.scan-mini-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.scan-mini-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  line-height: 1.4;
}

.scan-history-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.scan-history-item {
  border: 1.5px solid rgba(20, 18, 16, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.55);
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
}

.scan-history-item.active {
  border-color: var(--ink);
  background: rgba(255, 217, 102, 0.2);
}

.scan-history-title {
  font-size: 14px;
  font-weight: 700;
}

.scan-history-meta,
.scan-history-summary {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
}

.scan-history-side {
  display: grid;
  justify-items: flex-end;
  gap: 6px;
}

.scan-history-amount {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
}

.scan-card-actions {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.scan-card-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}

.scan-chat-composer {
  position: sticky;
  bottom: 0;
  padding: 12px 16px 84px;
  background: linear-gradient(to bottom, transparent, var(--cream) 35%);
}

.scan-composer-stack {
  display: grid;
  gap: 10px;
  width: 100%;
}

.scan-reply-form {
  display: flex;
  gap: 10px;
  align-items: center;
}

.scan-reply-input {
  flex: 1;
}

.scan-composer-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.scan-hidden-input {
  display: none;
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

  .scan-card-actions {
    grid-template-columns: auto 1fr;
    align-items: center;
  }
}

@media (max-width: 640px) {
  .scan-history-item {
    flex-direction: column;
  }

  .scan-history-side {
    justify-items: flex-start;
  }

  .scan-reply-form,
  .scan-composer-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
