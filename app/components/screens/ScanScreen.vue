<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'
import ReceiptSplitPreview from '../scan/ReceiptSplitPreview.vue'
import PennyLoadingIndicator from '../scan/PennyLoadingIndicator.vue'
import { useBillAnalysisStream } from '../../composables/useBillAnalysisStream'
import { useLedgerState } from '../../composables/useLedgerState'

const props = defineProps({
  chatId: {
    type: String,
    default: '',
  },
})

const route = useRoute()
const analysis = useBillAnalysisStream()
const ledger = useLedgerState()
const cameraInput = ref(null)
const fileInput = ref(null)
const previewUrl = ref('')
const selectedFile = ref(null)
const showCameraCapture = ref(false)
const scrollRef = ref(null)
const composerText = ref('')
const autoQuestionKey = ref('')
const composerSeedKey = ref('')
const groupCleared = ref(false)
const localGroupId = ref('')
const leadMessages = ref([])
const tailMessages = ref([])

const { ledger: ledgerData } = ledger
const {
  selectedGroup: ledgerSelectedGroup,
  setSelectedGroup,
  stageBillComposerDraft,
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

function getQueryGroupId() {
  return String(route.query.groupId || '').trim()
}

const availableGroups = computed(() => ledgerData.value.groups || [])
const persistedGroupId = computed(() => String(analysis.result.value?.groupId || '').trim())
const selectedGroup = computed(() => {
  if (groupCleared.value) {
    return null
  }

  const resolvedGroupId = String(localGroupId.value || persistedGroupId.value || '').trim()
  return availableGroups.value.find(group => group.id === resolvedGroupId) || null
})
const hasSavedChat = computed(() => Boolean(analysis.chatId.value))
const isRunning = computed(() => ['starting', 'queued', 'extracting', 'agent'].includes(analysis.status.value))
const isPennyLoading = computed(() => analysis.loadingChat.value || isRunning.value)
const pennyLoadingStatus = computed(() => (analysis.loadingChat.value ? 'loading-chat' : analysis.status.value))
const parsedReceipt = computed(() => {
  if (analysis.receipt.value) {
    return analysis.receipt.value
  }

  if (!analysis.result.value) {
    return null
  }

  return {
    billDate: analysis.result.value.billDate || '',
    currency: analysis.result.value.currency || 'EUR',
    items: Array.isArray(analysis.result.value.items) ? analysis.result.value.items : [],
    merchant: analysis.result.value.merchant || '',
    notes: Array.isArray(analysis.result.value.notes) ? analysis.result.value.notes : [],
    taxCents: Number(analysis.result.value.taxCents || 0),
    tipCents: Number(analysis.result.value.tipCents || 0),
    totalCents: Number(analysis.result.value.totalCents || 0),
  }
})
const parsedItems = computed(() => parsedReceipt.value?.items || [])
const parsedItemCount = computed(() => parsedItems.value.length)
const resolvedCurrency = computed(() => parsedReceipt.value?.currency || 'EUR')
const noteList = computed(() => parsedReceipt.value?.notes || [])
const splitRows = computed(() => analysis.result.value?.split || [])
const billTimeLabel = computed(() => {
  const note = noteList.value.find(note => /^Bill time\b/i.test(note))
  return String(note || '').replace(/^Bill time\b/i, '').trim()
})
const vatLabel = computed(() => {
  const note = noteList.value.find(note => /^Contains\b.*\bVAT\b/i.test(note))
  return String(note || '').replace(/^Contains\b/i, '').trim()
})
const taxRowLabel = computed(() => (
  vatLabel.value ? `Tax (${vatLabel.value})` : 'Tax'
))
const hasVerifiedTotal = computed(() => (
  noteList.value.some(note => /^Total matches sum of subtotal and tax\.?$/i.test(note))
))
const visibleReceiptNotes = computed(() => (
  noteList.value.filter(note =>
    !/^Bill time\b/i.test(note)
    && !/^Contains\b.*\bVAT\b/i.test(note)
    && !/^Total matches sum of subtotal and tax\.?$/i.test(note),
  )
))
const visibleAnalysisFeed = computed(() =>
  analysis.feed.value.filter((entry) => {
    const text = String(entry?.text || '').trim()
    return text
      && text !== `Uploaded a receipt for ${selectedGroup.value?.name || ''} receipt.`
      && !/^Uploaded a receipt for .+\.$/.test(text)
      && !/^Started a text-based receipt scan for .+\.$/.test(text)
      && !/^Started a receipt scan for .+\.$/.test(text)
  }),
)
const pinnedBottomFeedEntry = computed(() => {
  if (!parsedReceipt.value || isPennyLoading.value || !visibleAnalysisFeed.value.length) {
    return null
  }

  return visibleAnalysisFeed.value[visibleAnalysisFeed.value.length - 1]
})
const feedAboveReceipt = computed(() => {
  if (!pinnedBottomFeedEntry.value) {
    return visibleAnalysisFeed.value
  }

  return visibleAnalysisFeed.value.slice(0, -1)
})
const analysisSource = computed(() => String(analysis.result.value?.source || '').trim())
const awaitingSplitAnswer = computed(() => analysisSource.value === 'pi-agent-question' && !splitRows.value.length)
const shouldRequestGroupQuestion = computed(() =>
  Boolean(
    analysis.chatId.value
    && parsedReceipt.value
    && !selectedGroup.value
    && !splitRows.value.length
    && !awaitingSplitAnswer.value
    && !isRunning.value
    && availableGroups.value.length
  ),
)
const showGroupPickerPrompt = computed(() =>
  Boolean(
    awaitingSplitAnswer.value
    && !selectedGroup.value
    && availableGroups.value.length,
  ),
)
const awaitingGroupSelection = computed(() =>
  Boolean(
    parsedReceipt.value
    && !selectedGroup.value
    && availableGroups.value.length,
  ),
)
const splitPeople = computed(() => {
  if (!selectedGroup.value?.memberships?.length) {
    return []
  }

  return selectedGroup.value.memberships
    .map((membership) => String(membership?.person?.name || '').trim())
    .filter(Boolean)
})
const canOpenBillComposer = computed(() =>
  Boolean(parsedReceipt.value && selectedGroup.value),
)
const canPickReceipt = computed(() => Boolean(availableGroups.value.length && !isRunning.value && !hasSavedChat.value))
const canReset = computed(() =>
  Boolean(
    previewUrl.value
    || analysis.chatId.value
    || analysis.result.value
    || visibleAnalysisFeed.value.length
    || leadMessages.value.length
    || tailMessages.value.length,
  ),
)
const canSend = computed(() => Boolean(composerText.value.trim()))
const headerStatus = computed(() => {
  if (analysis.loadingChat.value) {
    return 'Loading'
  }

  if (analysis.error.value) {
    return 'Error'
  }

  if (isRunning.value) {
    return 'Parsing'
  }

  if (parsedReceipt.value) {
    return `${parsedItemCount.value} items`
  }

  if (selectedGroup.value) {
    return 'Ready'
  }

  return 'Ready to scan'
})
const introMessage = computed(() => {
  if (!availableGroups.value.length) {
    return 'Create a group first, then come back here to scan receipts.'
  }

  if (!selectedGroup.value) {
    return parsedReceipt.value
      ? 'Receipt parsed.'
      : 'Ready for a receipt.'
  }

  if (analysis.loadingChat.value) {
    return `Loading the saved receipt for ${selectedGroup.value.name}.`
  }

  if (parsedReceipt.value) {
    if (isRunning.value) {
      return `Using ${selectedGroup.value.name}. The bill items are ready, so you can open the composer now or wait for Penny to finish the split.`
    }

    return awaitingSplitAnswer.value
      ? `Using ${selectedGroup.value.name}. Answer Penny's question so she can build the split.`
      : splitRows.value.length
      ? `Using ${selectedGroup.value.name}. Keep chatting to tweak the split or continue into the composer.`
      : `Using ${selectedGroup.value.name}. Penny has the bill items ready. Keep chatting or open the composer now.`
  }

  if (isRunning.value) {
    return `Using ${selectedGroup.value.name}. I’m parsing the receipt into bill items now.`
  }

  if (hasSavedChat.value) {
    return `This saved receipt is open. Reset if you want to start a new one.`
  }

  return `Using ${selectedGroup.value.name}. Upload a receipt and I’ll return just the bill items.`
})
const composerPlaceholder = computed(() => {
  if (!availableGroups.value.length) {
    return 'Create a group first'
  }

  if (!selectedGroup.value) {
    return 'Reply in chat'
  }

  if (isRunning.value) {
    return 'Receipt is parsing...'
  }

  if (parsedReceipt.value) {
    if (isRunning.value) {
      return 'Tell Penny who ate what or open the composer now'
    }

    return awaitingSplitAnswer.value
      ? "Answer Penny's split question"
      : splitRows.value.length
      ? 'Tell Penny what to change about the split'
      : 'Tell Penny who ate what or open the composer now'
  }

  if (hasSavedChat.value) {
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

  if (hasSavedChat.value) {
    return 'Saved chat'
  }

  return 'Upload'
})
const showShellTitle = computed(() =>
  !previewUrl.value
  && !hasSavedChat.value
  && !parsedReceipt.value
  && !leadMessages.value.some(entry => entry.who === 'user')
  && !tailMessages.value.some(entry => entry.who === 'user')
  && !visibleAnalysisFeed.value.some(entry => entry.who === 'user'),
)

function formatMoney(amountCents, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    currency,
    style: 'currency',
  }).format((amountCents || 0) / 100)
}

function formatAmountInput(amountCents) {
  return ((amountCents || 0) / 100).toFixed(2).replace('.', ',')
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

function pushLocalMessage(who, text) {
  const normalizedText = String(text || '').trim()

  if (!normalizedText) {
    return
  }

  const targetMessages =
    previewUrl.value || visibleAnalysisFeed.value.length || parsedReceipt.value || hasSavedChat.value
      ? tailMessages
      : leadMessages

  targetMessages.value = [...targetMessages.value, {
    text: normalizedText,
    who,
  }]
}

function resetDraftInputs() {
  autoQuestionKey.value = ''
  composerText.value = ''
  composerSeedKey.value = ''
  groupCleared.value = false
  selectedFile.value = null
  leadMessages.value = []
  tailMessages.value = []
  clearInputs()
  revokePreview()
}

function initializeFreshScan() {
  resetDraftInputs()
  const queryGroupId = getQueryGroupId()
  localGroupId.value = availableGroups.value.some(group => group.id === queryGroupId)
    ? queryGroupId
    : ''
}

function resolveGroupFromMessage(message) {
  const normalizedMessage = String(message || '').trim().toLowerCase()

  if (!normalizedMessage) {
    return null
  }

  const exactMatch = availableGroups.value.find((group) =>
    String(group.name || '').trim().toLowerCase() === normalizedMessage,
  )

  if (exactMatch) {
    return exactMatch
  }

  const partialMatches = availableGroups.value.filter((group) => {
    const groupName = String(group.name || '').trim().toLowerCase()
    return groupName.includes(normalizedMessage) || normalizedMessage.includes(groupName)
  })

  if (partialMatches.length === 1) {
    return partialMatches[0]
  }

  return null
}

function getGroupPeople(group) {
  if (!group?.memberships?.length) {
    return []
  }

  return group.memberships
    .map((membership) => String(membership?.person?.name || '').trim())
    .filter(Boolean)
}

function confirmGroup(group, userText) {
  groupCleared.value = false
  localGroupId.value = group.id

  if (parsedReceipt.value) {
    return
  }

  if (userText) {
    pushLocalMessage('user', userText)
  }

  pushLocalMessage('assistant', `Using ${group.name}. Upload a receipt and I’ll parse just the bill items.`)
}

async function startFileAnalysis(file) {
  const title = selectedGroup.value?.name
    ? `${selectedGroup.value.name} receipt`
    : 'Receipt scan'

  await analysis.startFromFile({
    file,
    groupId: selectedGroup.value?.id || '',
    people: splitPeople.value,
    title,
  })
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

function onFileChange(event) {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  setFile(file)
  void startFileAnalysis(file)
}

async function onPickGroup(group) {
  if (parsedReceipt.value) {
    groupCleared.value = false
    localGroupId.value = group.id
    await analysis.confirmGroupSelection(group.name, getGroupPeople(group), group.name, group.id)
    return
  }

  confirmGroup(group, group.name)
}

async function onSend() {
  const message = String(composerText.value || '').trim()

  if (!message) {
    return
  }

  composerText.value = ''

  const matchingGroup = resolveGroupFromMessage(message)

  if (awaitingGroupSelection.value && matchingGroup) {
    groupCleared.value = false
    localGroupId.value = matchingGroup.id
    await analysis.confirmGroupSelection(matchingGroup.name, getGroupPeople(matchingGroup), matchingGroup.name, matchingGroup.id)
    return
  }

  if (!selectedGroup.value) {
    if (matchingGroup) {
      confirmGroup(matchingGroup, message)
      return
    }

    pushLocalMessage('user', message)
    pushLocalMessage(
      'assistant',
      parsedReceipt.value
        ? 'I could not match that to a group. Type the exact group name or tap one below so Penny can split it.'
        : 'I could not match that to a group. Upload a receipt first, then pick the group here.',
    )
    return
  }

  if (!parsedReceipt.value && matchingGroup) {
    confirmGroup(matchingGroup, message)
    return
  }

  if (parsedReceipt.value) {
    await analysis.revise(message, splitPeople.value, selectedGroup.value?.id || '')
    return
  }

  pushLocalMessage('user', message)
  pushLocalMessage('assistant', 'Upload an image first, then I can help with the split.')
}

async function hydrateSavedChat(nextChatId) {
  const normalizedChatId = String(nextChatId || '').trim()

  if (!normalizedChatId) {
    return null
  }

  composerText.value = ''
  clearInputs()
  const loadedChat = await analysis.loadChat(normalizedChatId)
  const persistedGroupId = String(loadedChat?.groupId || '').trim()

  if (persistedGroupId && availableGroups.value.some(group => group.id === persistedGroupId)) {
    groupCleared.value = false
    localGroupId.value = persistedGroupId
  }

  return loadedChat
}

async function resetScan() {
  analysis.reset()
  initializeFreshScan()

  if (getResolvedChatId()) {
    await navigateTo('/scan')
  }
}

function clearGroup() {
  groupCleared.value = true
  localGroupId.value = ''

  if (parsedReceipt.value) {
    autoQuestionKey.value = ''
    void analysis.requestGroupQuestion()
    return
  }

  pushLocalMessage('assistant', 'Pick the group for this receipt.')
}

async function continueToSplit() {
  if (!selectedGroup.value || !parsedReceipt.value) {
    return false
  }

  const seedChatId = String(analysis.chatId.value || analysis.result.value?.chatId || '').trim()
  const seedRunId = String(analysis.result.value?.runId || '').trim()
  const hasResolvedSplit = splitRows.value.length > 0
  const planDraftItems = Array.isArray(analysis.result.value?.billItems)
    ? analysis.result.value.billItems.map((item, index) => {
        const assignedPersonIds = (item.assignedPeople || [])
          .map((personName) => selectedGroup.value?.memberships?.find((entry) =>
            String(entry?.person?.name || '').trim().toLowerCase() === String(personName || '').trim().toLowerCase(),
          )?.personId || '')
          .filter(Boolean)

        if (!assignedPersonIds.length) {
          return null
        }

        return {
          amount: formatAmountInput(item.amountCents || 0),
          assignedPersonIds,
          id: `scan-plan-${seedRunId || seedChatId || Date.now()}-${index}`,
          name: item.name || `Item ${index + 1}`,
        }
      }).filter(Boolean)
    : []
  const seedMode = planDraftItems.length ? 'plan' : hasResolvedSplit ? 'split' : 'parsed'
  const seedKey = `${seedChatId || selectedGroup.value.id}:${seedRunId || 'pending'}:${seedMode}`

  if (composerSeedKey.value === seedKey) {
    return true
  }

  const splitDraftItems = planDraftItems.length
    ? planDraftItems
    : hasResolvedSplit
    ? splitRows.value.map((row, index) => {
        const membership = selectedGroup.value?.memberships?.find((entry) =>
          String(entry?.person?.name || '').trim().toLowerCase() === String(row.person || '').trim().toLowerCase(),
        )

        if (!membership) {
          return null
        }

        return {
          amount: formatAmountInput(row.amountCents || 0),
          assignedPersonIds: [membership.personId],
          id: `scan-split-${seedChatId || Date.now()}-${index}`,
          name: `${row.person} share`,
        }
      }).filter(Boolean)
    : []

  stageBillComposerDraft({
    billDate: parsedReceipt.value.billDate || '',
    billItems: splitDraftItems.length
      ? splitDraftItems
      : parsedItems.value.length
      ? parsedItems.value.map((item, index) => ({
          amount: formatAmountInput(item.amountCents || 0),
          assignedPersonIds: [],
          id: `scan-item-${seedChatId || Date.now()}-${index}`,
          name: item.name || `Item ${index + 1}`,
        }))
      : [],
    billPaidByPersonId: selectedGroup.value.memberships?.[0]?.personId || '',
    billTip: splitDraftItems.length ? '0.00' : formatAmountInput(parsedReceipt.value.tipCents || 0),
    billTitle: parsedReceipt.value.merchant || `${selectedGroup.value.name} receipt`,
    billTotal: formatAmountInput(parsedReceipt.value.totalCents || 0),
    groupId: selectedGroup.value.id,
  })

  composerSeedKey.value = seedKey
  return true
}

async function openBillComposerFromScan() {
  const group = selectedGroup.value || ledgerSelectedGroup.value

  if (!group) {
    return
  }

  if (!selectedGroup.value) {
    localGroupId.value = group.id
  }

  setSelectedGroup(group.id)
  analysis.stop()
  composerSeedKey.value = ''
  const hasDraft = await continueToSplit()

  if (!hasDraft) {
    return
  }

  await navigateTo(`/groups/${group.id}/bills/new`)
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
    () => visibleAnalysisFeed.value.length,
    () => parsedReceipt.value,
    () => analysis.error.value,
    () => leadMessages.value.length,
    () => tailMessages.value.length,
    () => localGroupId.value,
  ],
  () => {
    scrollToBottom()
  },
  { deep: true },
)

watch(
  [
    () => analysis.chatId.value,
    () => analysis.result.value?.runId,
    () => shouldRequestGroupQuestion.value,
  ],
  () => {
    if (!shouldRequestGroupQuestion.value) {
      return
    }

    const questionKey = `${analysis.chatId.value}:${analysis.result.value?.runId || 'pending'}:group`

    if (autoQuestionKey.value === questionKey) {
      return
    }

    autoQuestionKey.value = questionKey
    void analysis.requestGroupQuestion()
  },
)

watch(() => analysis.result.value?.groupId, (nextGroupId) => {
  const normalizedGroupId = String(nextGroupId || '').trim()

  if (!normalizedGroupId || groupCleared.value || localGroupId.value === normalizedGroupId) {
    return
  }

  if (availableGroups.value.some(group => group.id === normalizedGroupId)) {
    localGroupId.value = normalizedGroupId
  }
})

watch(() => props.chatId, (nextChatId, previousChatId) => {
  const resolvedChatId = String(nextChatId || '').trim() || getPathChatId()

  if (!resolvedChatId) {
    if (previousChatId || analysis.chatId.value || analysis.result.value) {
      analysis.reset()
    }

    initializeFreshScan()
    return
  }

  if (analysis.chatId.value === resolvedChatId && previewUrl.value) {
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
    <section class="section-pad scan-chat-wrap">
      <div class="scan-chat-shell">
        <div class="scan-chat-shell-head">
          <div>
            <div class="scan-panel-kicker scan-panel-kicker-on-dark">
              Scan chat
            </div>
            <div v-if="showShellTitle" class="scan-chat-shell-title">
              Chat first. Receipt next.
            </div>
          </div>

          <div class="scan-chat-shell-meta">
            <div class="scan-shell-chip">
              {{ selectedGroup ? selectedGroup.name : 'No group' }}
            </div>
            <div class="scan-shell-chip">
              {{ headerStatus }}
            </div>
          </div>
        </div>

        <div
          ref="scrollRef"
          class="chat-stream scan-chat-stream"
        >
          <div class="scan-chat-row">
            <div class="scan-avatar">
              <IconGlyph name="sparkle" width="16" height="16" />
            </div>
            <div class="scan-bubble assistant">
              {{ introMessage }}
            </div>
          </div>

          <div v-if="!availableGroups.length" class="scan-chat-row">
            <div class="scan-avatar system">
              <IconGlyph name="groups" width="16" height="16" />
            </div>
            <div class="scan-bubble system">
              <div>No local groups exist yet.</div>
              <div class="scan-choice-row">
                <NuxtLink class="scan-choice-button scan-choice-link" to="/groups">
                  Open groups
                </NuxtLink>
              </div>
            </div>
          </div>

          <div
            v-for="(entry, index) in leadMessages"
            :key="`lead-${entry.text}-${index}`"
            class="scan-chat-row"
            :class="entry.who === 'user' ? 'user' : ''"
          >
            <div v-if="entry.who !== 'user'" class="scan-avatar">
              <IconGlyph name="sparkle" width="16" height="16" />
            </div>
            <div class="scan-bubble" :class="entry.who === 'user' ? 'user' : 'assistant'">
              {{ entry.text }}
            </div>
          </div>

          <div v-if="previewUrl" class="scan-chat-row">
            <div class="scan-avatar">
              <IconGlyph name="sparkle" width="16" height="16" />
            </div>
            <div class="scan-preview-stage">
              <ReceiptSplitPreview
                :image-src="previewUrl"
                :status="analysis.status.value"
                :title="selectedGroup ? `${selectedGroup.name} receipt` : 'Receipt preview'"
                :total-label="parsedReceipt ? formatMoney(parsedReceipt.totalCents || 0, resolvedCurrency) : ''"
              />
            </div>
          </div>

          <div
            v-for="(entry, index) in feedAboveReceipt"
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

          <div v-if="!parsedReceipt && showGroupPickerPrompt" class="scan-choice-row scan-choice-row-inline">
            <button
              v-for="group in availableGroups"
              :key="group.id"
              class="scan-choice-button"
              @click="onPickGroup(group)"
            >
              {{ group.name }}
            </button>
          </div>

          <div v-if="analysis.error.value" class="scan-chat-row system">
            <div class="scan-avatar system">
              <IconGlyph name="scan" width="16" height="16" />
            </div>
            <div class="scan-bubble system error">
              {{ analysis.error.value }}
            </div>
          </div>

          <div v-if="parsedReceipt" class="scan-chat-row">
            <div class="scan-avatar">
              <IconGlyph name="sparkle" width="16" height="16" />
            </div>

            <div class="scan-receipt-card">
              <div class="scan-receipt-head">
                <div>
                  <div class="scan-receipt-kicker">
                    Parsed bill
                  </div>
                  <div class="scan-receipt-title">
                    {{ parsedReceipt.merchant || 'Untitled receipt' }}
                  </div>
                </div>

                <div class="scan-receipt-head-side">
                  <div class="scan-receipt-total">
                    {{ formatMoney(parsedReceipt.totalCents || 0, resolvedCurrency) }}
                  </div>
                  <div v-if="billTimeLabel" class="scan-receipt-time">
                    Bill time {{ billTimeLabel }}
                  </div>
                </div>
              </div>

              <div class="scan-receipt-summary">
                {{ analysis.result.value?.summary || `Parsed ${parsedItemCount} bill items.` }}
              </div>

              <div v-if="splitRows.length" class="scan-split-list">
                <div
                  v-for="row in splitRows"
                  :key="row.person"
                  class="scan-item-row scan-split-row"
                >
                  <span class="scan-item-name">
                    {{ row.person }}
                  </span>
                  <span>{{ formatMoney(row.amountCents || 0, resolvedCurrency) }}</span>
                </div>
              </div>

              <div v-else class="scan-split-empty">
                <div class="scan-split-empty-title">
                  No split yet
                </div>
                <div class="scan-split-empty-copy">
                  Tell Penny who ate what so she can assign these items.
                </div>
                <div class="scan-split-empty-example">
                  Example: “Tempura Bento was Luca. Sushi Bento was Penny. Cola was shared by everyone.”
                </div>
              </div>

              <div class="scan-receipt-items">
                <div
                  v-for="(item, index) in parsedItems"
                  :key="`${item.name}-${index}`"
                  class="scan-item-row"
                >
                  <span class="scan-item-name">
                    {{ item.quantity > 1 ? `${item.quantity} x ${item.name}` : item.name }}
                  </span>
                  <span>{{ formatMoney(item.amountCents || 0, resolvedCurrency) }}</span>
                </div>
              </div>

              <div class="scan-receipt-totals">
                <div class="scan-mini-row">
                  <span>{{ taxRowLabel }}</span>
                  <span>{{ formatMoney(parsedReceipt.taxCents || 0, resolvedCurrency) }}</span>
                </div>
                <div class="scan-mini-row">
                  <span>Tip</span>
                  <span>{{ formatMoney(parsedReceipt.tipCents || 0, resolvedCurrency) }}</span>
                </div>
                <div class="scan-mini-row total">
                  <span class="scan-total-label">
                    <span>Total</span>
                    <span v-if="hasVerifiedTotal" class="scan-total-check" aria-label="Total verified">✓</span>
                  </span>
                  <span>{{ formatMoney(parsedReceipt.totalCents || 0, resolvedCurrency) }}</span>
                </div>
              </div>

              <div v-if="visibleReceiptNotes.length" class="scan-receipt-notes">
                <div
                  v-for="note in visibleReceiptNotes"
                  :key="note"
                  class="scan-note-row"
                >
                  {{ note }}
                </div>
              </div>

            </div>
          </div>

          <div v-if="canOpenBillComposer" class="scan-chat-row">
            <div class="scan-avatar">
              <IconGlyph name="sparkle" width="16" height="16" />
            </div>
            <button type="button" class="btn scan-composer-toggle" @click="openBillComposerFromScan">
              {{ splitRows.length ? 'Open bill composer' : 'Open bill composer now' }}
            </button>
          </div>

          <div
            v-if="pinnedBottomFeedEntry"
            class="scan-chat-row"
            :class="pinnedBottomFeedEntry.who === 'user' ? 'user' : pinnedBottomFeedEntry.who === 'penny' ? '' : 'system'"
          >
            <div
              v-if="pinnedBottomFeedEntry.who !== 'user'"
              class="scan-avatar"
              :class="pinnedBottomFeedEntry.who === 'penny' ? '' : 'system'"
            >
              <IconGlyph :name="pinnedBottomFeedEntry.who === 'penny' ? 'sparkle' : 'scan'" width="16" height="16" />
            </div>
            <div
              class="scan-bubble"
              :class="pinnedBottomFeedEntry.who === 'penny' ? 'assistant' : pinnedBottomFeedEntry.who === 'user' ? 'user' : 'system'"
            >
              {{ pinnedBottomFeedEntry.text }}
            </div>
          </div>

          <div v-if="pinnedBottomFeedEntry && showGroupPickerPrompt" class="scan-choice-row scan-choice-row-inline">
            <button
              v-for="group in availableGroups"
              :key="group.id"
              class="scan-choice-button"
              @click="onPickGroup(group)"
            >
              {{ group.name }}
            </button>
          </div>

          <div
            v-for="(entry, index) in tailMessages"
            :key="`tail-${entry.text}-${index}`"
            class="scan-chat-row"
            :class="entry.who === 'user' ? 'user' : ''"
          >
            <div v-if="entry.who !== 'user'" class="scan-avatar">
              <IconGlyph name="sparkle" width="16" height="16" />
            </div>
            <div class="scan-bubble" :class="entry.who === 'user' ? 'user' : 'assistant'">
              {{ entry.text }}
            </div>
          </div>

          <PennyLoadingIndicator
            v-if="isPennyLoading"
            :loading-chat="analysis.loadingChat.value"
            :status="pennyLoadingStatus"
          />
        </div>

        <div class="scan-chat-footer">
          <form class="scan-composer" @submit.prevent="onSend">
            <button
              type="button"
              class="scan-upload-trigger"
              :disabled="!canPickReceipt"
              @click="openReceiptPicker"
            >
              <IconGlyph name="scan" width="18" height="18" />
              <span>{{ uploadLabel }}</span>
            </button>

            <input
              v-model="composerText"
              type="text"
              class="scan-composer-input"
              :placeholder="composerPlaceholder"
            >

            <button
              type="submit"
              class="scan-send-button"
              :disabled="!canSend"
            >
              Send
            </button>
          </form>

          <div class="scan-footer-actions">
            <button
              v-if="selectedGroup"
              class="scan-footer-link"
              @click="clearGroup"
            >
              Change group
            </button>

            <button
              v-if="canReset"
              class="scan-footer-link"
              @click="resetScan"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
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
  min-height: 100vh;
  min-height: 100dvh;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  padding-bottom: 32px;
}

.scan-chat-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: 18px;
}

.scan-chat-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 32px;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(246, 181, 51, 0.14), transparent 28%),
    linear-gradient(180deg, #151311 0%, #231b16 100%);
  border: 1px solid rgba(20, 18, 16, 0.08);
  box-shadow: 0 28px 60px rgba(38, 24, 10, 0.18);
}

.scan-chat-shell-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 20px 20px 0;
}

.scan-panel-kicker {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.scan-panel-kicker-on-dark {
  color: rgba(246, 240, 228, 0.6);
}

.scan-chat-shell-title {
  margin-top: 8px;
  color: var(--cream);
  font-size: clamp(28px, 6vw, 44px);
  line-height: 0.95;
  max-width: 10ch;
}

.scan-chat-shell-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.scan-shell-chip {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--cream);
  font-size: 12px;
  font-weight: 600;
}

.scan-chat-stream {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.scan-chat-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.scan-chat-row.user {
  justify-content: flex-end;
}

.scan-avatar {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(246, 181, 51, 0.16);
  color: var(--marigold);
}

.scan-avatar.system {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(246, 240, 228, 0.7);
}

.scan-bubble {
  max-width: min(100%, 680px);
  border-radius: 22px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.5;
}

.scan-bubble.assistant,
.scan-bubble.system {
  background: rgba(255, 255, 255, 0.08);
  color: var(--cream);
}

.scan-bubble.user {
  background: var(--cream);
  color: var(--ink);
}

.scan-bubble.error {
  border: 1px solid rgba(255, 84, 54, 0.32);
  color: #ffd2ca;
}

.scan-choice-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.scan-choice-row-inline {
  padding-left: 42px;
}

.scan-choice-button {
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: var(--cream);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.scan-choice-link {
  display: inline-flex;
  align-items: center;
}

.scan-composer-toggle {
  background: var(--marigold);
  color: var(--ink);
  border: 1.5px solid var(--marigold);
}

.scan-preview-stage {
  width: min(100%, 720px);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 38px rgba(24, 16, 10, 0.18);
}

.scan-preview-stage :deep(.receipt-split-stage) {
  min-height: 320px;
}

.scan-receipt-card {
  width: min(100%, 720px);
  border-radius: 24px;
  background: rgba(251, 247, 238, 0.96);
  color: var(--ink);
  padding: 18px;
  box-shadow: 0 20px 38px rgba(24, 16, 10, 0.12);
}

.scan-composer-stage {
  width: min(100%, 1080px);
  border-radius: 24px;
  overflow: hidden;
  background: rgba(251, 247, 238, 0.96);
  box-shadow: 0 20px 38px rgba(24, 16, 10, 0.12);
}

.scan-receipt-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.scan-receipt-head-side {
  display: grid;
  justify-items: end;
  gap: 6px;
}

.scan-receipt-kicker {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.scan-receipt-title {
  margin-top: 6px;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 700;
}

.scan-receipt-total {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
}

.scan-receipt-time {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(20, 18, 16, 0.58);
}

.scan-receipt-summary {
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(20, 18, 16, 0.72);
}

.scan-receipt-items {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.scan-split-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(20, 18, 16, 0.05);
}

.scan-split-empty {
  display: grid;
  gap: 6px;
  margin-top: 16px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(20, 18, 16, 0.05);
}

.scan-split-empty-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(20, 18, 16, 0.65);
}

.scan-split-empty-copy {
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink);
}

.scan-split-empty-example {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(20, 18, 16, 0.68);
}

.scan-item-row,
.scan-mini-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.scan-item-row {
  font-size: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(20, 18, 16, 0.08);
}

.scan-item-name {
  font-weight: 600;
}

.scan-receipt-totals {
  display: grid;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(20, 18, 16, 0.1);
  font-size: 13px;
  color: rgba(20, 18, 16, 0.7);
}

.scan-mini-row.total {
  font-weight: 700;
  color: var(--ink);
}

.scan-total-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.scan-total-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(143, 197, 106, 0.18);
  color: #4d7f31;
  font-size: 12px;
  line-height: 1;
}

.scan-receipt-notes {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.scan-note-row {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(20, 18, 16, 0.05);
  font-size: 12px;
  line-height: 1.45;
}

.scan-chat-footer {
  display: grid;
  gap: 10px;
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.scan-composer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
}

.scan-upload-trigger,
.scan-send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 13px 18px;
  border: 0;
  border-radius: 999px;
  font-weight: 700;
}

.scan-upload-trigger {
  min-width: 116px;
  background: var(--marigold);
  color: var(--ink);
}

.scan-send-button {
  min-width: 92px;
  background: var(--cream);
  color: var(--ink);
}

.scan-upload-trigger:disabled,
.scan-send-button:disabled {
  opacity: 0.55;
}

.scan-composer-input {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--cream);
  padding: 13px 16px;
  outline: none;
}

.scan-composer-input::placeholder {
  color: rgba(246, 240, 228, 0.45);
}

.scan-footer-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.scan-footer-link {
  border: 0;
  background: transparent;
  color: rgba(246, 240, 228, 0.72);
  padding: 0;
  font-size: 13px;
  font-weight: 600;
}

.scan-hidden-input {
  display: none;
}

@media (min-width: 768px) {
  .scan-chat-screen {
    min-height: calc(100vh - 120px);
    min-height: calc(100dvh - 120px);
    height: calc(100vh - 120px);
    height: calc(100dvh - 120px);
    padding-bottom: 16px;
  }
}

@media (max-width: 720px) {
  .scan-chat-shell {
    border-radius: 24px;
  }

  .scan-chat-shell-head {
    flex-direction: column;
  }

  .scan-chat-shell-meta {
    justify-content: flex-start;
  }

  .scan-choice-row-inline {
    padding-left: 0;
  }

  .scan-composer {
    grid-template-columns: 1fr;
  }

  .scan-upload-trigger,
  .scan-send-button {
    width: 100%;
  }
}
</style>
