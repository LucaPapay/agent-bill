import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildScanBillComposerDraft } from '../lib/scan-bill-draft'
import { useBillAnalysisStream } from './useBillAnalysisStream'
import { useLedgerState } from './useLedgerState'
import { useScanPreview } from './useScanPreview'
import { useScanVoiceInput } from './useScanVoiceInput'

function buildGroupChoices(groups: any[]) {
  return groups.map(group => ({
    id: group.id,
    name: group.name,
  }))
}

export function useScanScreenState(props: { chatId?: string }) {
  const route = useRoute()
  const analysis = useBillAnalysisStream()
  const ledger = useLedgerState()
  const preview = useScanPreview()
  const composerText = ref('')
  const selectedGroupOverrideId = ref<any>(undefined)

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

  const availableGroups = computed(() => ledgerData.value.groups || [])
  const queryGroupId = computed(() => {
    const groupId = String(route.query.groupId || '').trim()

    if (!groupId) {
      return ''
    }

    return availableGroups.value.some((group: any) => group.id === groupId)
      ? groupId
      : ''
  })
  const selectedGroupId = computed(() => {
    if (selectedGroupOverrideId.value === '') {
      return ''
    }

    return String(
      selectedGroupOverrideId.value
      || analysis.groupId.value
      || queryGroupId.value
      || '',
    ).trim()
  })
  const selectedGroup = computed(() => {
    return availableGroups.value.find((group: any) => group.id === selectedGroupId.value) || null
  })
  const hasSavedChat = computed(() => Boolean(analysis.chatId.value))
  const isRunning = computed(() => ['starting', 'queued', 'extracting', 'agent'].includes(analysis.status.value))
  const parsedReceipt = analysis.parsedReceipt
  const splitRows = analysis.splitRows
  const showCreateGroupsHint = computed(() => !availableGroups.value.length)
  const showGroupPickerPrompt = computed(() =>
    Boolean(
      parsedReceipt.value
      && !selectedGroup.value
      && !isRunning.value
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
      .map((membership: any) => String(membership?.person?.name || '').trim())
      .filter(Boolean)
  })
  const canOpenBillComposer = computed(() =>
    Boolean(parsedReceipt.value && selectedGroup.value),
  )
  const canPickReceipt = computed(() =>
    Boolean(
      availableGroups.value.length
      && !isRunning.value
      && !hasSavedChat.value
      && !voice.isRecordingVoice.value
      && !voice.isTranscribingVoice.value,
    ),
  )
  const canReset = computed(() =>
    Boolean(
      preview.previewUrl.value
      || analysis.chatId.value
      || analysis.result.value
      || analysis.messages.value.length,
    ),
  )
  const canStartVoiceInput = computed(() =>
    Boolean(
      availableGroups.value.length
      && !analysis.loadingChat.value
      && !isRunning.value
      && !voice.isTranscribingVoice.value
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
  const canSend = computed(() => Boolean(
    composerText.value.trim()
    && !voice.isRecordingVoice.value
    && !voice.isTranscribingVoice.value,
  ))
  const headerStatus = computed(() => {
    if (analysis.loadingChat.value) {
      return 'Loading'
    }

    if (analysis.error.value) {
      return 'Error'
    }

    if (voice.isTranscribingVoice.value) {
      return 'Transcribing'
    }

    if (voice.isRecordingVoice.value) {
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

    if (voice.isTranscribingVoice.value) {
      return 'Transcribing voice note...'
    }

    if (voice.isRecordingVoice.value) {
      return 'Recording voice note...'
    }

    if (parsedReceipt.value) {
      return splitRows.value.length
        ? 'Tell Penny what to change about the split'
        : 'Pick the group or keep chatting'
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
    !preview.previewUrl.value
    && !hasSavedChat.value
    && !parsedReceipt.value
    && !analysis.messages.value.some((entry: any) => entry.role === 'user'),
  )
  const transcriptMessages = analysis.messages

  function appendTranscriptToComposer(text: string) {
    const normalizedText = String(text || '').trim()

    if (!normalizedText) {
      return
    }

    const existingText = String(composerText.value || '').trim()
    composerText.value = existingText ? `${existingText} ${normalizedText}` : normalizedText
  }

  function pushLocalMessage(role: string, text: string) {
    const normalizedText = String(text || '').trim()

    if (!normalizedText) {
      return
    }

    analysis.appendLocalMessage(role, normalizedText)
  }

  function clearLocalState() {
    voice.teardown()
    composerText.value = ''
    selectedGroupOverrideId.value = undefined
    preview.clearInputs()
    preview.revokePreview()
    analysis.setGroupSelectMessage(null)
  }

  function resolveGroupFromMessage(message: string) {
    const normalizedMessage = String(message || '').trim().toLowerCase()

    if (!normalizedMessage) {
      return null
    }

    const exactMatch = availableGroups.value.find((group: any) =>
      String(group.name || '').trim().toLowerCase() === normalizedMessage,
    )

    if (exactMatch) {
      return exactMatch
    }

    const partialMatches = availableGroups.value.filter((group: any) => {
      const groupName = String(group.name || '').trim().toLowerCase()
      return groupName.includes(normalizedMessage) || normalizedMessage.includes(groupName)
    })

    if (partialMatches.length === 1) {
      return partialMatches[0]
    }

    return null
  }

  function getGroupPeople(group: any) {
    if (!group?.memberships?.length) {
      return []
    }

    return group.memberships
      .map((membership: any) => String(membership?.person?.name || '').trim())
      .filter(Boolean)
  }

  function confirmGroup(group: any, userText: string) {
    selectedGroupOverrideId.value = group.id

    if (parsedReceipt.value) {
      return
    }

    if (userText) {
      pushLocalMessage('user', userText)
    }

    pushLocalMessage('assistant', `Using ${group.name}. Upload a receipt and I’ll parse just the bill items.`)
  }

  async function startFileAnalysis(file: File) {
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
    preview.openReceiptPicker(canPickReceipt.value)
  }

  function onFileChange(event: any) {
    preview.onFileChange(event, startFileAnalysis)
  }

  async function onPickGroup(group: any) {
    if (parsedReceipt.value) {
      selectedGroupOverrideId.value = group.id
      await analysis.confirmGroupSelection(group.name, getGroupPeople(group), group.name, group.id)
      return
    }

    confirmGroup(group, group.name)
  }

  async function onPickGroupId(groupId: string) {
    const group = availableGroups.value.find((entry: any) => entry.id === groupId)

    if (!group) {
      return
    }

    await onPickGroup(group)
  }

  async function onSend() {
    const message = String(composerText.value || '').trim()

    if (!message) {
      return
    }

    composerText.value = ''

    const matchingGroup = resolveGroupFromMessage(message)

    if (awaitingGroupSelection.value && matchingGroup) {
      selectedGroupOverrideId.value = matchingGroup.id
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

  async function hydrateSavedChat(nextChatId: string) {
    const normalizedChatId = String(nextChatId || '').trim()

    if (!normalizedChatId) {
      return null
    }

    clearLocalState()
    return await analysis.loadChat(normalizedChatId)
  }

  async function resetScan() {
    analysis.reset()
    clearLocalState()

    if (getResolvedChatId()) {
      await navigateTo('/scan')
    }
  }

  function clearGroup() {
    selectedGroupOverrideId.value = ''

    pushLocalMessage('assistant', 'Pick the group for this receipt.')
  }

  async function continueToSplit() {
    if (!selectedGroup.value || !parsedReceipt.value) {
      return false
    }

    const nextDraft = buildScanBillComposerDraft({
      chatId: analysis.chatId.value,
      group: selectedGroup.value,
      receipt: parsedReceipt.value,
      result: analysis.result.value,
    })

    if (!nextDraft) {
      return false
    }

    stageBillComposerDraft(nextDraft.draft)
    return true
  }

  async function openBillComposerFromScan() {
    const group = selectedGroup.value || ledgerSelectedGroup.value

    if (!group) {
      return
    }

    if (!selectedGroup.value) {
      selectedGroupOverrideId.value = group.id
    }

    setSelectedGroup(group.id)
    const hasDraft = await continueToSplit()

    if (!hasDraft) {
      return
    }

    await navigateTo(`/groups/${group.id}/bills/new`)
  }

  watch(() => props.chatId, (nextChatId, previousChatId) => {
    const resolvedChatId = String(nextChatId || '').trim() || getPathChatId()

    if (!resolvedChatId) {
      if (previousChatId || analysis.chatId.value || analysis.result.value) {
        analysis.reset()
      }

      clearLocalState()
      return
    }

    if (analysis.chatId.value === resolvedChatId && (preview.previewUrl.value || analysis.result.value?.chatId === resolvedChatId)) {
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

  watch(() => [
    showGroupPickerPrompt.value,
    parsedReceipt.value?.merchant || '',
    availableGroups.value.map((group: any) => `${group.id}:${group.name}`).join('|'),
  ], () => {
    if (!showGroupPickerPrompt.value) {
      analysis.setGroupSelectMessage(null)
      return
    }

    analysis.setGroupSelectMessage({
      data: {
        groups: buildGroupChoices(availableGroups.value),
      },
      id: 'group-select',
      role: 'assistant',
      text: 'Pick the group for this receipt.',
    })
  }, { immediate: true })

  onMounted(() => {
    void ledger.ensureLoaded()
    preview.setup()
    voice.setup()
  })

  onBeforeUnmount(() => {
    voice.teardown()
    preview.teardown()
    analysis.stop()
  })

  return {
    cameraInput: preview.cameraInput,
    canOpenBillComposer,
    canPickReceipt,
    canRecordVoice: voice.canRecordVoice,
    canReset,
    canSend,
    clearGroup,
    composerPlaceholder,
    composerText,
    headerStatus,
    isRecordingVoice: voice.isRecordingVoice,
    isTranscribingVoice: voice.isTranscribingVoice,
    onFileChange,
    onPickGroupId,
    onSend,
    openBillComposerFromScan,
    openReceiptPicker,
    fileInput: preview.fileInput,
    resetScan,
    selectedGroup,
    showCreateGroupsHint,
    showShellTitle,
    showVoiceButton: voice.showVoiceButton,
    toggleVoiceInput: voice.toggleVoiceInput,
    transcriptMessages,
    uploadLabel,
    voiceStatusLabel: voice.voiceStatusLabel,
  }
}
