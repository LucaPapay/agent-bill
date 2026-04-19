import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildScanBillComposerDraft } from '../lib/scan-bill-draft'
import { useLedgerState } from './useLedgerState'
import { usePennyChat } from './usePennyChat'
import { useScanPreview } from './useScanPreview'
import { useScanVoiceInput } from './useScanVoiceInput'

export function useScanScreenState(props: { chatId?: string }) {
  const route = useRoute()
  const chat = usePennyChat()
  const ledger = useLedgerState()
  const preview = useScanPreview()
  const composerText = ref('')
  const selectedGroupOverrideId = ref<any>(undefined)
  const context = chat.context

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
  const contextStatus = computed(() => String(context.value?.status || 'idle').trim() || 'idle')
  const parsedReceipt = computed(() => context.value?.receipt || null)
  const splitRows = computed(() => Array.isArray(context.value?.split) ? context.value.split : [])
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
      || context.value?.groupId
      || queryGroupId.value
      || '',
    ).trim()
  })
  const selectedGroup = computed(() => {
    return availableGroups.value.find((group: any) => group.id === selectedGroupId.value) || null
  })
  const hasSavedChat = computed(() => Boolean(chat.chatId.value))
  const isRunning = computed(() => ['starting', 'queued', 'extracting', 'agent', 'running'].includes(contextStatus.value))
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
  const linkedBillGroupId = computed(() => String(context.value?.linkedBillGroupId || '').trim())
  const linkedBillId = computed(() => String(context.value?.linkedBillId || '').trim())
  const canOpenSavedBill = computed(() =>
    Boolean(linkedBillGroupId.value && linkedBillId.value),
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
      chat.chatId.value
      || parsedReceipt.value
      || chat.messages.value.length,
    ),
  )
  const canStartVoiceInput = computed(() =>
    Boolean(
      availableGroups.value.length
      && contextStatus.value !== 'loading'
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

  function appendTranscriptToComposer(text: string) {
    const normalizedText = String(text || '').trim()

    if (!normalizedText) {
      return
    }

    const existingText = String(composerText.value || '').trim()
    composerText.value = existingText ? `${existingText} ${normalizedText}` : normalizedText
  }

  function clearLocalState() {
    voice.teardown()
    composerText.value = ''
    selectedGroupOverrideId.value = undefined
    preview.clearInputs()
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
  }

  async function startFileAnalysis(file: File) {
    const title = selectedGroup.value?.name
      ? `${selectedGroup.value.name} receipt`
      : 'Receipt scan'

    await chat.startFromFile({
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
      await chat.confirmGroupSelection(group.name, getGroupPeople(group), group.name, group.id)
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

    const matchingGroup = resolveGroupFromMessage(message)

    if (awaitingGroupSelection.value && matchingGroup) {
      composerText.value = ''
      selectedGroupOverrideId.value = matchingGroup.id
      await chat.confirmGroupSelection(matchingGroup.name, getGroupPeople(matchingGroup), matchingGroup.name, matchingGroup.id)
      return
    }

    if (!selectedGroup.value) {
      if (matchingGroup) {
        composerText.value = ''
        confirmGroup(matchingGroup, message)
      }

      return
    }

    if (!parsedReceipt.value && matchingGroup) {
      composerText.value = ''
      confirmGroup(matchingGroup, message)
      return
    }

    if (parsedReceipt.value) {
      composerText.value = ''
      await chat.revise(message, splitPeople.value, selectedGroup.value?.id || '')
    }
  }

  async function hydrateSavedChat(nextChatId: string) {
    const normalizedChatId = String(nextChatId || '').trim()

    if (!normalizedChatId) {
      return null
    }

    clearLocalState()
    return await chat.loadChat(normalizedChatId)
  }

  async function resetScan() {
    chat.reset()
    clearLocalState()

    if (getResolvedChatId()) {
      await navigateTo('/scan')
    }
  }

  function clearGroup() {
    selectedGroupOverrideId.value = ''
  }

  async function continueToSplit() {
    if (!selectedGroup.value || !parsedReceipt.value) {
      return false
    }

    const nextDraft = buildScanBillComposerDraft({
      chatId: chat.chatId.value,
      group: selectedGroup.value,
      receipt: parsedReceipt.value,
      result: context.value,
    })

    if (!nextDraft) {
      return false
    }

    stageBillComposerDraft(nextDraft.draft)
    return true
  }

  async function openBillDestinationFromScan() {
    if (canOpenSavedBill.value) {
      await navigateTo(`/groups/${linkedBillGroupId.value}/bills/${linkedBillId.value}`)
      return
    }

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

    const chatQuery = chat.chatId.value
      ? `?chatId=${encodeURIComponent(chat.chatId.value)}`
      : ''

    await navigateTo(`/groups/${group.id}/bills/new${chatQuery}`)
  }

  watch(() => props.chatId, (nextChatId, previousChatId) => {
    const resolvedChatId = String(nextChatId || '').trim() || getPathChatId()

    if (!resolvedChatId) {
      if (previousChatId || chat.chatId.value || parsedReceipt.value || chat.messages.value.length) {
        chat.reset()
      }

      clearLocalState()
      return
    }

    if (chat.chatId.value === resolvedChatId && String(context.value?.chatId || '').trim() === resolvedChatId) {
      return
    }

    void hydrateSavedChat(resolvedChatId)
  }, { immediate: true })

  watch(() => chat.chatId.value, (nextChatId) => {
    if (!nextChatId || nextChatId === props.chatId) {
      return
    }

    void navigateTo(`/scan/${nextChatId}`, { replace: true })
  })

  onMounted(() => {
    void ledger.ensureLoaded()
    preview.setup()
    voice.setup()
  })

  onBeforeUnmount(() => {
    voice.teardown()
    preview.teardown()
    chat.stop()
  })

  return {
    availableGroups,
    cameraInput: preview.cameraInput,
    canPickReceipt,
    canRecordVoice: voice.canRecordVoice,
    canReset,
    canSend,
    clearGroup,
    composerText,
    context,
    fileInput: preview.fileInput,
    isRecordingVoice: voice.isRecordingVoice,
    isRunning,
    isTranscribingVoice: voice.isTranscribingVoice,
    messages: chat.messages,
    onFileChange,
    onPickGroupId,
    onSend,
    openBillDestinationFromScan,
    openReceiptPicker,
    parsedReceipt,
    resetScan,
    selectedGroup,
    showVoiceButton: voice.showVoiceButton,
    splitRows,
    toggleVoiceInput: voice.toggleVoiceInput,
    voiceStatusLabel: voice.voiceStatusLabel,
  }
}
