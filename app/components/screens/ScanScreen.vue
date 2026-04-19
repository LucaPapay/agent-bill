<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ScanChatComposer from '../scan/ScanChatComposer.vue'
import ScanChatMessageGroupSelect from '../scan/ScanChatMessageGroupSelect.vue'
import ScanChatTranscript from '../scan/ScanChatTranscript.vue'
import PennyLoadingIndicator from '../scan/PennyLoadingIndicator.vue'
import ScanReceiptCard from '../scan/ScanReceiptCard.vue'
import { buildScanBillComposerDraft } from '../../lib/scan-bill-draft'
import { useLedgerState } from '../../composables/useLedgerState'
import { usePennyChat } from '../../composables/usePennyChat'
import { useScanPreview } from '../../composables/useScanPreview'
import { useScanVoiceInput } from '../../composables/useScanVoiceInput'

const route = useRoute()
const ledger = useLedgerState()
const chat = usePennyChat()
const preview = useScanPreview()
const composerText = ref('')
const selectedGroupOverrideId = ref('')

const bodyRef = ref(null)
const context = chat.context
const messages = chat.messages
const routeChatId = computed(() => normalizeText(route.params.chatId))
const availableGroups = computed(() => ledger.ledger.value.groups || [])
const parsedReceipt = computed(() => context.value?.receipt || null)
const splitRows = computed(() => Array.isArray(context.value?.split) ? context.value.split : [])
const queryGroupId = computed(() => {
  const groupId = String(route.query.groupId || '').trim()

  if (!groupId) {
    return ''
  }

  return availableGroups.value.some(group => group.id === groupId)
    ? groupId
    : ''
})
const selectedGroupId = computed(() =>
  String(
    selectedGroupOverrideId.value
    || context.value?.groupId
    || queryGroupId.value
    || '',
  ).trim(),
)
const selectedGroup = computed(() =>
  availableGroups.value.find(group => group.id === selectedGroupId.value) || null,
)
const hasSavedChat = computed(() => Boolean(chat.chatId.value))
const isRunning = computed(() =>
  ['starting', 'queued', 'extracting', 'agent', 'running'].includes(String(context.value?.status || '').trim()),
)
const splitPeople = computed(() => getGroupPeople(selectedGroup.value))
const canReset = computed(() =>
  Boolean(chat.chatId.value || parsedReceipt.value || messages.value.length),
)
const canStartVoiceInput = computed(() =>
  Boolean(
    availableGroups.value.length
    && String(context.value?.status || '').trim() !== 'loading'
    && !isRunning.value
    && (!hasSavedChat.value || parsedReceipt.value),
  ),
)
const voice = useScanVoiceInput({
  getAvailableGroups: () => availableGroups.value,
  getCanRecordVoice: () => canStartVoiceInput.value,
  getGroupName: () => selectedGroup.value?.name || '',
  getPeople: () => splitPeople.value,
  onTranscript: appendTranscriptToComposer,
})
const cameraInput = preview.cameraInput
const fileInput = preview.fileInput
const isRecordingVoice = voice.isRecordingVoice
const isTranscribingVoice = voice.isTranscribingVoice
const showVoiceButton = voice.showVoiceButton
const toggleVoiceInput = voice.toggleVoiceInput
const voiceStatusLabel = voice.voiceStatusLabel
const canRecordVoice = voice.canRecordVoice
const matchingGroupForComposer = computed(() => resolveGroupFromMessage(composerText.value))
const canPickReceipt = computed(() =>
  Boolean(
    availableGroups.value.length
    && !isRunning.value
    && !hasSavedChat.value
    && !isRecordingVoice.value
    && !isTranscribingVoice.value,
  ),
)
const canSend = computed(() => Boolean(
  composerText.value.trim()
  && !isRecordingVoice.value
  && !isTranscribingVoice.value
  && (parsedReceipt.value || matchingGroupForComposer.value),
))
const showCreateGroupsHint = computed(() => !availableGroups.value.length)
const showGroupPickerPrompt = computed(() =>
  Boolean(
    parsedReceipt.value
    && !selectedGroup.value
    && !isRunning.value
    && availableGroups.value.length,
  ),
)
const canOpenSavedBill = computed(() =>
  Boolean(context.value?.linkedBillGroupId && context.value?.linkedBillId),
)
const canOpenBillComposer = computed(() =>
  Boolean(parsedReceipt.value && selectedGroup.value),
)
const canContinueToBill = computed(() =>
  Boolean(canOpenSavedBill.value || canOpenBillComposer.value),
)
const showChatError = computed(() =>
  context.value?.status === 'error' && context.value?.summary,
)
const showShellTitle = computed(() =>
  !context.value?.chatId
  && !parsedReceipt.value
  && !messages.value.some(entry => entry.role === 'user'),
)
const headerStatus = computed(() => {
  if (context.value?.status === 'loading') {
    return 'Loading'
  }

  if (context.value?.status === 'error') {
    return 'Error'
  }

  if (isTranscribingVoice.value) {
    return 'Transcribing'
  }

  if (isRecordingVoice.value) {
    return 'Recording'
  }

  if (isRunning.value) {
    return 'Parsing'
  }

  if (parsedReceipt.value) {
    const parsedItemCount = Array.isArray(parsedReceipt.value.items) ? parsedReceipt.value.items.length : 0
    return `${parsedItemCount} items`
  }

  if (selectedGroup.value) {
    return 'Ready'
  }

  return 'Ready to scan'
})
const receiptTotalLabel = computed(() => {
  if (!parsedReceipt.value) {
    return ''
  }

  return new Intl.NumberFormat('en-US', {
    currency: parsedReceipt.value.currency || 'EUR',
    style: 'currency',
  }).format((parsedReceipt.value.totalCents || 0) / 100)
})
const composerPlaceholder = computed(() => {
  if (!availableGroups.value.length) {
    return 'Create a group first'
  }

  if (!selectedGroup.value) {
    return parsedReceipt.value ? 'Type the group name' : 'Reply in chat'
  }

  if (isRunning.value) {
    return 'Receipt is parsing...'
  }

  if (isTranscribingVoice.value) {
    return 'Transcribing voice note...'
  }

  if (isRecordingVoice.value) {
    return 'Recording voice note...'
  }

  if (parsedReceipt.value) {
    return splitRows.value.length
      ? 'Tell Penny what to change about the split'
      : 'Pick the group or keep chatting'
  }

  if (context.value?.chatId) {
    return 'Reset to start a new receipt'
  }

  return 'Type another group name or upload a receipt'
})
const uploadLabel = computed(() => {
  if (!availableGroups.value.length) {
    return 'No groups'
  }

  if (!selectedGroup.value) {
    return 'Upload'
  }

  if (isRunning.value) {
    return 'Parsing...'
  }

  if (context.value?.chatId) {
    return 'Saved chat'
  }

  return 'Upload'
})
const billActionCopy = computed(() =>
  canOpenSavedBill.value
    ? 'This chat already has a saved bill. Open it to review or edit the ledger entry.'
    : 'The receipt is parsed. Continue into the bill composer when you are ready.',
)
const billActionLabel = computed(() =>
  canOpenSavedBill.value ? 'Open saved bill' : 'Open bill composer',
)

function normalizeText(value) {
  return String(value || '').trim()
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.split(',')[1] || '' : value)
    }

    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

function appendTranscriptToComposer(text) {
  const normalizedText = normalizeText(text)

  if (!normalizedText) {
    return
  }

  composerText.value = composerText.value
    ? `${composerText.value} ${normalizedText}`.trim()
    : normalizedText
}

function getGroupPeople(group) {
  if (!group?.memberships?.length) {
    return []
  }

  return group.memberships
    .map(membership => normalizeText(membership?.person?.name))
    .filter(Boolean)
}

function resolveGroupFromMessage(message) {
  const normalizedMessage = normalizeText(message).toLowerCase()

  if (!normalizedMessage) {
    return null
  }

  const exactMatch = availableGroups.value.find((group) =>
    normalizeText(group.name).toLowerCase() === normalizedMessage,
  )

  if (exactMatch) {
    return exactMatch
  }

  const partialMatches = availableGroups.value.filter((group) => {
    const groupName = normalizeText(group.name).toLowerCase()
    return groupName.includes(normalizedMessage) || normalizedMessage.includes(groupName)
  })

  return partialMatches.length === 1 ? partialMatches[0] : null
}

function buildUserMessage(text, data = {}) {
  return {
    data,
    role: 'user',
    text: normalizeText(text),
  }
}

function clearLocalState() {
  composerText.value = ''
  selectedGroupOverrideId.value = ''
  preview.clearInputs()
  voice.teardown()
}

async function startFileAnalysis(file) {
  const imageBase64 = await fileToBase64(file)

  if (!imageBase64) {
    return
  }

  await chat.sendMessages([buildUserMessage('', {
    groupId: selectedGroup.value?.id || undefined,
    imageBase64,
    mimeType: file.type || 'image/jpeg',
    people: splitPeople.value,
    title: selectedGroup.value?.name
      ? `${selectedGroup.value.name} receipt`
      : 'Receipt scan',
  })], {
    resetChat: true,
  })
}

function openReceiptPicker() {
  preview.openReceiptPicker(canPickReceipt.value)
}

function onFileChange(event) {
  preview.onFileChange(event, startFileAnalysis)
}

async function onPickGroupId(groupId) {
  const group = availableGroups.value.find(entry => entry.id === groupId)

  if (!group) {
    return
  }

  selectedGroupOverrideId.value = group.id

  if (!parsedReceipt.value) {
    return
  }

  await chat.sendMessages([buildUserMessage(group.name, {
    groupId: group.id,
    people: getGroupPeople(group),
  })])
}

async function onSend() {
  const message = normalizeText(composerText.value)

  if (!message) {
    return
  }

  const matchingGroup = resolveGroupFromMessage(message)

  if (!selectedGroup.value) {
    if (!matchingGroup) {
      return
    }

    composerText.value = ''
    selectedGroupOverrideId.value = matchingGroup.id

    if (!parsedReceipt.value) {
      return
    }

    await chat.sendMessages([buildUserMessage(message, {
      groupId: matchingGroup.id,
      people: getGroupPeople(matchingGroup),
    })])

    return
  }

  if (!parsedReceipt.value) {
    if (matchingGroup) {
      composerText.value = ''
      selectedGroupOverrideId.value = matchingGroup.id
    }

    return
  }

  const group = matchingGroup || selectedGroup.value

  composerText.value = ''
  selectedGroupOverrideId.value = group.id

  await chat.sendMessages([buildUserMessage(message, {
    groupId: group.id,
    people: getGroupPeople(group),
  })])
}

async function resetScan() {
  chat.reset()
  clearLocalState()

  if (routeChatId.value) {
    await navigateTo('/scan')
  }
}

function clearGroup() {
  selectedGroupOverrideId.value = ''
}

async function openBillDestinationFromScan() {
  if (canOpenSavedBill.value) {
    await navigateTo(`/groups/${context.value.linkedBillGroupId}/bills/${context.value.linkedBillId}`)
    return
  }

  const group = selectedGroup.value || ledger.selectedGroup.value

  if (!group || !parsedReceipt.value) {
    return
  }

  if (!selectedGroup.value) {
    selectedGroupOverrideId.value = group.id
  }

  ledger.setSelectedGroup(group.id)

  const nextDraft = buildScanBillComposerDraft({
    chatId: chat.chatId.value,
    group,
    receipt: parsedReceipt.value,
    result: context.value,
  })

  if (!nextDraft) {
    return
  }

  ledger.stageBillComposerDraft(nextDraft.draft)

  const chatQuery = chat.chatId.value
    ? `?chatId=${encodeURIComponent(chat.chatId.value)}`
    : ''

  await navigateTo(`/groups/${group.id}/bills/new${chatQuery}`)
}

function scrollBodyToBottom() {
  nextTick(() => {
    if (!bodyRef.value) {
      return
    }

    bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  })
}

watch(() => [
  messages.value.length,
  context.value.status,
  Boolean(parsedReceipt.value),
  showGroupPickerPrompt.value,
  canContinueToBill.value,
  showCreateGroupsHint.value,
], scrollBodyToBottom)

watch(routeChatId, async (nextChatId) => {
  clearLocalState()

  if (!nextChatId) {
    if (chat.chatId.value || parsedReceipt.value || messages.value.length) {
      chat.reset()
    }

    return
  }

  await chat.loadChat(nextChatId, { force: true })
})

watch(() => chat.chatId.value, (nextChatId) => {
  if (!nextChatId || nextChatId === routeChatId.value) {
    return
  }

  void navigateTo(`/scan/${nextChatId}`, { replace: true })
})

onMounted(async () => {
  void ledger.ensureLoaded()
  preview.setup()
  voice.setup()

  const nextChatId = routeChatId.value

  if (nextChatId) {
    clearLocalState()
    await chat.loadChat(nextChatId, { force: true })
  }
})

onBeforeUnmount(() => {
  voice.teardown()
  preview.teardown()
  chat.stop()
})
</script>

<template>
  <div class="screen h-[100vh] min-h-[100vh] min-h-[100dvh] overflow-hidden pb-8 md:h-[calc(100dvh-120px)] md:min-h-[calc(100dvh-120px)] md:pb-4">
    <section class="section-pad flex min-h-0 flex-1 flex-col pt-[18px]">
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[rgba(20,18,16,0.08)] bg-[radial-gradient(circle_at_top_right,rgba(246,181,51,0.14),transparent_28%),linear-gradient(180deg,#151311_0%,#231b16_100%)] shadow-[0_28px_60px_rgba(38,24,10,0.18)] md:rounded-[32px]">
        <div class="flex flex-col items-start justify-between gap-4 px-5 pt-5 md:flex-row">
          <div>
            <div class="font-[var(--mono)] text-[10px] font-bold uppercase tracking-[0.1em] text-[rgba(246,240,228,0.6)]">
              Scan chat
            </div>
            <div v-if="showShellTitle" class="mt-2 max-w-[10ch] text-[clamp(28px,6vw,44px)] leading-[0.95] text-[var(--cream)]">
              Chat first. Receipt next.
            </div>
          </div>

          <div class="flex flex-wrap justify-start gap-2 md:justify-end">
            <div class="rounded-full bg-white/8 px-3 py-2 text-xs font-semibold text-[var(--cream)]">
              {{ selectedGroup ? selectedGroup.name : 'No group' }}
            </div>
            <div class="rounded-full bg-white/8 px-3 py-2 text-xs font-semibold text-[var(--cream)]">
              {{ headerStatus }}
            </div>
          </div>
        </div>

        <div
          ref="bodyRef"
          class="min-h-0 flex-1 overflow-y-auto"
        >
          <ScanChatTranscript
            :messages="messages"
            :preview-status="context.status || ''"
            :preview-total-label="receiptTotalLabel"
          />

          <div
            v-if="showChatError"
            class="px-5 pb-4"
          >
            <div class="w-[min(100%,720px)] rounded-[22px] bg-[rgba(255,84,54,0.12)] px-4 py-3 text-sm leading-6 text-[#ffd2ca]">
              {{ context.summary }}
            </div>
          </div>

          <div
            v-if="parsedReceipt"
            class="px-5 pb-4"
          >
            <ScanReceiptCard
              :linked-bill-group-id="context.linkedBillGroupId || ''"
              :linked-bill-id="context.linkedBillId || ''"
              :receipt="parsedReceipt"
              :split-rows="splitRows"
              :summary="context.summary || ''"
            />
          </div>

          <div
            v-if="context.status === 'loading' || isRunning"
            class="px-5 pb-4"
          >
            <PennyLoadingIndicator
              :loading-chat="context.status === 'loading'"
              :status="context.status === 'running' ? 'agent' : (context.status || 'idle')"
            />
          </div>

          <div
            v-if="showGroupPickerPrompt"
            class="px-5 pb-4"
          >
            <ScanChatMessageGroupSelect
              :groups="availableGroups"
              text="Pick the group for this receipt."
              @select-group="onPickGroupId"
            />
          </div>

          <div
            v-if="showCreateGroupsHint"
            class="flex items-center justify-between gap-3 px-5 pb-4"
          >
            <div class="text-sm leading-6 text-[rgba(246,240,228,0.78)]">
              Create a group first, then come back here to scan receipts.
            </div>
            <NuxtLink
              class="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-3.5 py-2.5 text-[13px] font-semibold text-[var(--cream)] transition hover:bg-white/12"
              to="/groups"
            >
              Open groups
            </NuxtLink>
          </div>

          <div
            v-else-if="canContinueToBill"
            class="flex items-center justify-between gap-3 px-5 pb-4"
          >
            <div class="text-sm leading-6 text-[rgba(246,240,228,0.78)]">
              {{ billActionCopy }}
            </div>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-full border border-[var(--marigold)] bg-[var(--marigold)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)]"
              @click="openBillDestinationFromScan"
            >
              {{ billActionLabel }}
            </button>
          </div>
        </div>

        <ScanChatComposer
          v-model="composerText"
          :can-pick-receipt="canPickReceipt"
          :can-record-voice="canRecordVoice"
          :can-reset="canReset"
          :can-send="canSend"
          :composer-placeholder="composerPlaceholder"
          :is-recording-voice="isRecordingVoice"
          :is-transcribing-voice="isTranscribingVoice"
          :selected-group-name="selectedGroup ? selectedGroup.name : ''"
          :show-voice-button="showVoiceButton"
          :upload-label="uploadLabel"
          :voice-status-label="voiceStatusLabel"
          @clear-group="clearGroup"
          @pick-receipt="openReceiptPicker"
          @reset="resetScan"
          @send="onSend"
          @toggle-voice="toggleVoiceInput"
        />
      </div>
    </section>

    <input
      ref="cameraInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="onFileChange"
    >

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    >
  </div>
</template>
