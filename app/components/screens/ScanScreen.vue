<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'
import ReceiptSplitPreview from '../scan/ReceiptSplitPreview.vue'
import { people } from '../app/mockData'
import { useBillAnalysisStream } from '../../composables/useBillAnalysisStream'

const emit = defineEmits(['done'])

const analysis = useBillAnalysisStream()
const cameraInput = ref(null)
const fileInput = ref(null)
const previewUrl = ref('')
const selectedFile = ref(null)
const showCameraCapture = ref(false)
const title = ref('Dinner receipt')
const peopleText = ref(people.join(', '))

const parsedPeople = computed(() =>
  [...new Set(
    peopleText.value
      .split(/[\n,]/)
      .map(value => value.trim())
      .filter(Boolean),
  )],
)

const safeTitle = computed(() => title.value.trim() || 'Untitled bill')
const isRunning = computed(() => ['starting', 'queued', 'extracting', 'agent'].includes(analysis.status.value))
const canPickReceipt = computed(() => parsedPeople.value.length > 0 && !isRunning.value)
const canContinue = computed(() => analysis.status.value === 'complete' && Boolean(analysis.result.value))
const scanResult = computed(() => analysis.result.value)
const extractedReceipt = computed(() => analysis.receipt.value || scanResult.value?.receipt || null)
const splitRows = computed(() => scanResult.value?.split || [])
const assistantReply = computed(() => analysis.assistantText.value.trim())
const pickerLabel = computed(() => showCameraCapture.value ? 'Use camera' : 'Upload receipt')
const inputModeLabel = computed(() => {
  if (selectedFile.value) {
    return showCameraCapture.value ? 'camera image' : 'image upload'
  }

  return 'waiting for image'
})
const resolvedTotalCents = computed(() => scanResult.value?.totalCents || extractedReceipt.value?.totalCents || 0)
const resolvedCurrency = computed(() => extractedReceipt.value?.currency || scanResult.value?.currency || 'EUR')
const totalLabel = computed(() => formatMoney(
  resolvedTotalCents.value,
  resolvedCurrency.value,
))
const statusLabel = computed(() => {
  if (analysis.status.value === 'extracting') {
    return 'OpenAI is extracting the receipt.'
  }

  if (analysis.status.value === 'agent') {
    return 'Penny is building the split.'
  }

  if (analysis.status.value === 'complete') {
    return 'Split ready.'
  }

  if (analysis.status.value === 'error') {
    return analysis.error.value || 'The scan failed.'
  }

  if (analysis.status.value === 'queued') {
    return 'Receipt queued.'
  }

  if (analysis.status.value === 'starting') {
    return 'Opening the live analysis stream.'
  }

  if (!parsedPeople.value.length) {
    return 'Add at least one person before scanning.'
  }

  return 'Choose a receipt image to start the analysis immediately.'
})

function formatMoney(amountCents, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    currency,
    style: 'currency',
  }).format((amountCents || 0) / 100)
}

function revokePreview() {
  if (!previewUrl.value) {
    return
  }

  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

function setFile(file) {
  revokePreview()
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

function clearInputs() {
  if (cameraInput.value) {
    cameraInput.value.value = ''
  }

  if (fileInput.value) {
    fileInput.value.value = ''
  }
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

function resetScan() {
  selectedFile.value = null
  analysis.reset()
  clearInputs()
  revokePreview()
}

function continueToChat() {
  if (!canContinue.value) {
    return
  }

  emit('done')
}

onMounted(() => {
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
  <div class="screen">
    <div class="section-pad scan-page">
      <div class="scan-header">
        <div>
          <span class="tape">Live scan</span>
          <h1 class="h-display scan-title">
            Turn a receipt into a split.
          </h1>
          <p class="scan-copy">
            The flow is simple now: send a receipt to OpenAI for structure, let Penny run one Pi agent pass, then review the split.
          </p>
        </div>

        <div class="scan-badges">
          <div class="chip chip-muted">
            {{ parsedPeople.length }} people
          </div>
          <div class="chip chip-muted">
            {{ inputModeLabel }}
          </div>
        </div>
      </div>

      <div class="scan-layout">
        <section class="surface-panel scan-panel">
          <div class="scan-panel-head">
            <div>
              <div class="scan-kicker">
                Source
              </div>
              <div class="scan-panel-title">
                Receipt scan
              </div>
            </div>

            <button v-if="selectedFile || analysis.status.value !== 'idle'" class="scan-link" @click="resetScan">
              Reset
            </button>
          </div>

          <label class="scan-field">
            <span class="scan-field-label">Bill title</span>
            <input
              v-model="title"
              type="text"
              placeholder="Friday dinner"
              class="scan-input"
            >
          </label>

          <label class="scan-field">
            <span class="scan-field-label">People</span>
            <textarea
              v-model="peopleText"
              rows="2"
              placeholder="Jojo, Sarah, Miles"
              class="scan-input scan-textarea"
            />
          </label>

          <div class="scan-note">
            <div class="scan-note-label">
              How it works
            </div>
            <div>Pick a receipt photo and the backend starts analyzing it immediately.</div>
          </div>

          <div class="scan-preview">
            <ReceiptSplitPreview
              v-if="previewUrl"
              :image-src="previewUrl"
              :status="analysis.status.value"
              :title="safeTitle"
              :total-label="resolvedTotalCents ? totalLabel : ''"
            />

            <div v-else class="scan-placeholder">
              <div class="scan-placeholder-icon">
                <IconGlyph name="scan" width="34" height="34" />
              </div>
              <div class="scan-placeholder-title">
                Scan a real receipt
              </div>
              <div class="scan-placeholder-copy">
                Use the camera on mobile. Everywhere else, upload an image file.
              </div>
            </div>
          </div>

          <div class="scan-actions">
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

            <button class="btn btn-primary" :disabled="!canPickReceipt" @click="openReceiptPicker">
              {{ isRunning ? 'Analyzing...' : pickerLabel }}
            </button>

            <button class="scan-link" @click="resetScan">
              Clear result
            </button>
          </div>
        </section>

        <section class="surface-panel scan-panel">
          <div class="scan-panel-head">
            <div>
              <div class="scan-kicker">
                Live pipeline
              </div>
              <div class="scan-panel-title">
                Streamed analysis
              </div>
            </div>

            <div class="scan-status-chip" :class="analysis.status.value">
              {{ analysis.status.value }}
            </div>
          </div>

          <div class="scan-status-box">
            <div class="scan-status-title">
              {{ statusLabel }}
            </div>
            <div class="scan-status-meta">
              <span v-if="analysis.jobId.value">job {{ analysis.jobId.value.slice(0, 8) }}</span>
              <span v-if="resolvedTotalCents">{{ totalLabel }}</span>
            </div>
          </div>

          <div class="scan-feed">
            <div
              v-for="(entry, index) in analysis.feed.value.length ? analysis.feed.value : [{ who: 'log', text: 'Waiting for the first analysis run.' }]"
              :key="`${entry.text}-${index}`"
              class="scan-feed-row"
              :class="entry.who"
            >
              <div class="scan-feed-who">
                {{ entry.who === 'penny' ? 'Penny' : 'System' }}
              </div>
              <div class="scan-feed-text">
                {{ entry.text }}
              </div>
            </div>
          </div>

          <div v-if="assistantReply" class="scan-note">
            <div class="scan-note-label">
              Agent reply
            </div>
            <div>{{ assistantReply }}</div>
          </div>

          <div v-if="analysis.error.value" class="scan-error">
            {{ analysis.error.value }}
          </div>

          <div v-if="extractedReceipt" class="scan-result-card">
            <div class="scan-result-head">
              <div>
                <div class="scan-kicker">
                  Extracted receipt
                </div>
                <div class="scan-result-title">
                  {{ extractedReceipt.merchant || safeTitle }}
                </div>
              </div>
              <div class="mono" style="font-size: 11px; color: var(--muted);">
                {{ extractedReceipt.items?.length || 0 }} items
              </div>
            </div>

            <div class="scan-mini-list">
              <div
                v-for="(item, index) in (extractedReceipt.items || []).slice(0, 6)"
                :key="`${item.name}-${index}`"
                class="scan-mini-row"
              >
                <span>{{ item.name }}</span>
                <span>{{ formatMoney(item.amountCents || 0, resolvedCurrency) }}</span>
              </div>
            </div>
          </div>

          <div v-if="splitRows.length" class="scan-result-card">
            <div class="scan-result-head">
              <div>
                <div class="scan-kicker">
                  Final split
                </div>
                <div class="scan-result-title">
                  {{ scanResult.summary }}
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

            <div class="scan-footer-actions">
              <button class="btn btn-accent" :disabled="!canContinue" @click="continueToChat">
                Continue to split chat
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scan-page {
  padding-top: 24px;
  padding-bottom: 120px;
}

.scan-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 18px;
}

.scan-title {
  font-size: clamp(38px, 7vw, 68px);
  line-height: 0.95;
  margin: 10px 0 0;
  max-width: 10ch;
}

.scan-copy {
  max-width: 44rem;
  margin: 16px 0 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--muted);
}

.scan-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.scan-layout {
  display: grid;
  gap: 18px;
}

.scan-panel {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.scan-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.scan-kicker {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.scan-panel-title,
.scan-result-title {
  margin-top: 6px;
  font-size: 18px;
  line-height: 1.3;
  font-weight: 700;
}

.scan-preview {
  min-height: 320px;
  overflow: hidden;
  border-radius: 22px;
  background:
    radial-gradient(circle at top left, rgba(246, 181, 51, 0.18), transparent 38%),
    linear-gradient(180deg, #1b1712 0%, #0f0d0b 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.scan-preview-image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 320px;
  object-fit: cover;
}

.scan-placeholder,
.scan-text-preview {
  display: grid;
  place-items: center;
  min-height: 320px;
  padding: 24px;
  text-align: center;
  color: var(--cream);
}

.scan-placeholder-icon {
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--marigold);
  margin: 0 auto 14px;
}

.scan-placeholder-title {
  font-size: 18px;
  font-weight: 700;
}

.scan-placeholder-copy {
  max-width: 22rem;
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.55;
  color: rgba(246, 240, 228, 0.72);
}

.scan-text-preview {
  place-items: stretch;
  text-align: left;
}

.scan-text-preview-head {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(246, 240, 228, 0.6);
}

.scan-text-preview pre {
  margin: 12px 0 0;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.scan-actions,
.scan-footer-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.scan-hidden-input {
  display: none;
}

.scan-field {
  display: grid;
  gap: 6px;
}

.scan-field-label {
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

.scan-link {
  font-size: 12px;
  font-weight: 700;
  color: var(--tomato);
}

.scan-status-chip {
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(20, 18, 16, 0.08);
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.scan-status-chip.complete {
  background: rgba(143, 197, 106, 0.22);
  color: #416029;
}

.scan-status-chip.error {
  background: rgba(255, 84, 54, 0.18);
  color: #a9321b;
}

.scan-status-chip.extracting,
.scan-status-chip.agent,
.scan-status-chip.queued,
.scan-status-chip.starting {
  background: rgba(246, 181, 51, 0.2);
  color: #7c5300;
}

.scan-status-box,
.scan-note,
.scan-error,
.scan-result-card {
  border-radius: 20px;
  padding: 14px;
  background: var(--paper);
  border: 1px solid rgba(20, 18, 16, 0.08);
}

.scan-status-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
}

.scan-status-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
}

.scan-feed {
  display: grid;
  gap: 10px;
}

.scan-feed-row {
  border-radius: 18px;
  padding: 12px 14px;
  background: rgba(20, 18, 16, 0.05);
}

.scan-feed-row.penny {
  background: var(--ink);
  color: var(--cream);
}

.scan-feed-who {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
}

.scan-feed-text {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.45;
}

.scan-note-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 8px;
}

.scan-error {
  background: rgba(255, 84, 54, 0.12);
  border-color: rgba(255, 84, 54, 0.25);
  color: #8f2a16;
  font-weight: 600;
}

.scan-result-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
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

@media (min-width: 980px) {
  .scan-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
  }

  .scan-badges {
    justify-content: flex-end;
  }

  .scan-layout {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    align-items: start;
  }
}
</style>
