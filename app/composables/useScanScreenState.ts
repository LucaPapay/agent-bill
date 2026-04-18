import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildScanBillComposerDraft } from '../lib/scan-bill-draft'
import { useBillAnalysisStream } from './useBillAnalysisStream'
import { useLedgerState } from './useLedgerState'

function formatMoney(amountCents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    currency,
    style: 'currency',
  }).format((amountCents || 0) / 100)
}

function normalizeWho(who: string) {
  if (who === 'user' || who === 'penny' || who === 'assistant') {
    return who
  }

  return 'system'
}

function getToolName(entry: any) {
  const directToolName = String(entry?.toolName || '').trim()

  if (directToolName) {
    return directToolName
  }

  const text = String(entry?.text || '').trim()

  if (!/^Tool:\s*/.test(text)) {
    return ''
  }

  return text.replace(/^Tool:\s*/, '').trim()
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.split(',')[1] || '' : value)
    }

    reader.onerror = () => resolve('')
    reader.readAsDataURL(blob)
  })
}

function pickSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return ''
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]

  return candidates.find(candidate => MediaRecorder.isTypeSupported(candidate)) || ''
}

export function useScanScreenState(props: { chatId?: string }) {
  const route = useRoute()
  const analysis = useBillAnalysisStream()
  const ledger = useLedgerState()
  const cameraInput = ref<any>(null)
  const fileInput = ref<any>(null)
  const previewUrl = ref('')
  const showCameraCapture = ref(false)
  const composerText = ref('')
  const autoQuestionKey = ref('')
  const composerSeedKey = ref('')
  const groupCleared = ref(false)
  const localGroupId = ref('')
  const leadMessages = ref<any[]>([])
  const tailMessages = ref<any[]>([])
  const voiceMimeType = ref('')
  const voiceError = ref('')
  const voiceRecorder = ref<any>(null)
  const voiceRequestId = ref(0)
  const voiceShouldTranscribe = ref(false)
  const voiceStream = ref<any>(null)
  const isRecordingVoice = ref(false)
  const isTranscribingVoice = ref(false)
  const supportsVoiceInput = ref(false)

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
    return availableGroups.value.find((group: any) => group.id === resolvedGroupId) || null
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
  const noteList = computed(() => parsedReceipt.value?.notes || [])
  const splitRows = computed(() => analysis.result.value?.split || [])
  const visibleReceiptNotes = computed(() => (
    noteList.value.filter((note: string) =>
      !/^Bill time\b/i.test(note)
      && !/^Contains\b.*\bVAT\b/i.test(note)
      && !/^Total matches sum of subtotal and tax\.?$/i.test(note),
    )
  ))
  const visibleAnalysisFeed = computed(() =>
    analysis.feed.value.filter((entry: any) => {
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
  const awaitingPennyReply = computed(() =>
    !splitRows.value.length
    && (analysisSource.value === 'penny-message' || analysisSource.value === 'penny-question'),
  )
  const shouldRequestGroupQuestion = computed(() =>
    Boolean(
      analysis.chatId.value
      && parsedReceipt.value
      && !selectedGroup.value
      && !splitRows.value.length
      && !awaitingPennyReply.value
      && !isRunning.value
      && availableGroups.value.length
    ),
  )
  const showGroupPickerPrompt = computed(() =>
    Boolean(
      awaitingPennyReply.value
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
      .map((membership: any) => String(membership?.person?.name || '').trim())
      .filter(Boolean)
  })
  const canOpenBillComposer = computed(() =>
    Boolean(parsedReceipt.value && selectedGroup.value),
  )
  const canPickReceipt = computed(() =>
    Boolean(availableGroups.value.length && !isRunning.value && !hasSavedChat.value && !isRecordingVoice.value && !isTranscribingVoice.value),
  )
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
  const canSend = computed(() => Boolean(composerText.value.trim() && !isRecordingVoice.value && !isTranscribingVoice.value))
  const showVoiceButton = computed(() => supportsVoiceInput.value || isRecordingVoice.value || isTranscribingVoice.value)
  const canRecordVoice = computed(() =>
    Boolean(
      supportsVoiceInput.value
      && availableGroups.value.length
      && !analysis.loadingChat.value
      && !isRunning.value
      && !isTranscribingVoice.value
      && (!hasSavedChat.value || parsedReceipt.value),
    ),
  )
  const voiceStatusLabel = computed(() => {
    if (voiceError.value) {
      return voiceError.value
    }

    if (isTranscribingVoice.value) {
      return 'Transcribing voice note...'
    }

    if (isRecordingVoice.value) {
      return 'Recording. Tap stop when you are done.'
    }

    return ''
  })
  const headerStatus = computed(() => {
    if (analysis.loadingChat.value) {
      return 'Loading'
    }

    if (analysis.error.value) {
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

    if (isRunning.value) {
      return `Using ${selectedGroup.value.name}. I’m parsing the receipt into bill items now.`
    }

    if (parsedReceipt.value) {
      return awaitingPennyReply.value
        ? `Using ${selectedGroup.value.name}. Penny replied. Keep chatting or continue into the composer.`
        : splitRows.value.length
        ? `Using ${selectedGroup.value.name}. Keep chatting to tweak the split or continue into the composer.`
        : `Using ${selectedGroup.value.name}. Penny has the receipt and is moving on to the split.`
    }

    if (hasSavedChat.value) {
      return 'This saved receipt is open. Reset if you want to start a new one.'
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

    if (isTranscribingVoice.value) {
      return 'Transcribing voice note...'
    }

    if (isRecordingVoice.value) {
      return 'Recording voice note...'
    }

    if (parsedReceipt.value) {
      return awaitingPennyReply.value
        ? 'Reply to Penny'
        : splitRows.value.length
        ? 'Tell Penny what to change about the split'
        : 'Wait for Penny to draft the split'
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
    && !visibleAnalysisFeed.value.some((entry: any) => entry.who === 'user'),
  )
  const transcriptBlocks = computed(() => {
    const blocks: any[] = [{
      id: 'intro',
      kind: 'message',
      text: introMessage.value,
      who: 'penny',
    }]

    if (!availableGroups.value.length) {
      blocks.push({
        id: 'empty-groups',
        kind: 'empty-groups',
      })
    }

    leadMessages.value.forEach((entry, index) => {
      blocks.push({
        id: `lead-${index}`,
        kind: 'message',
        text: entry.text,
        who: normalizeWho(entry.who),
      })
    })

    if (previewUrl.value) {
      blocks.push({
        id: 'preview',
        imageSrc: previewUrl.value,
        kind: 'preview',
        status: analysis.status.value,
        title: selectedGroup.value ? `${selectedGroup.value.name} receipt` : 'Receipt preview',
        totalLabel: parsedReceipt.value
          ? formatMoney(parsedReceipt.value.totalCents || 0, parsedReceipt.value.currency || 'EUR')
          : '',
      })
    }

    feedAboveReceipt.value.forEach((entry: any, index: number) => {
      const toolName = getToolName(entry)

      blocks.push(toolName
        ? {
            id: `feed-top-tool-${index}`,
            kind: 'tool',
            state: String(entry.toolState || 'done'),
            toolName,
          }
        : {
            id: `feed-top-message-${index}`,
            kind: 'message',
            text: entry.text,
            who: normalizeWho(entry.who),
          })
    })

    if (!parsedReceipt.value && showGroupPickerPrompt.value) {
      blocks.push({
        groups: availableGroups.value.map((group: any) => ({ id: group.id, name: group.name })),
        id: 'group-picker-top',
        kind: 'group-picker',
      })
    }

    if (analysis.error.value) {
      blocks.push({
        id: 'error',
        kind: 'error',
        text: analysis.error.value,
      })
    }

    if (parsedReceipt.value) {
      blocks.push({
        id: 'receipt',
        kind: 'receipt',
        receipt: parsedReceipt.value,
        splitRows: splitRows.value,
        summary: analysis.result.value?.summary || '',
        visibleNotes: visibleReceiptNotes.value,
      })
    }

    if (canOpenBillComposer.value) {
      blocks.push({
        id: 'composer-cta',
        kind: 'composer-cta',
        label: splitRows.value.length ? 'Open bill composer' : 'Open bill composer now',
      })
    }

    if (pinnedBottomFeedEntry.value) {
      const toolName = getToolName(pinnedBottomFeedEntry.value)

      blocks.push(toolName
        ? {
            id: 'feed-bottom-tool',
            kind: 'tool',
            state: String(pinnedBottomFeedEntry.value.toolState || 'done'),
            toolName,
          }
        : {
            id: 'feed-bottom-message',
            kind: 'message',
            text: pinnedBottomFeedEntry.value.text,
            who: normalizeWho(pinnedBottomFeedEntry.value.who),
          })
    }

    if (pinnedBottomFeedEntry.value && showGroupPickerPrompt.value) {
      blocks.push({
        groups: availableGroups.value.map((group: any) => ({ id: group.id, name: group.name })),
        id: 'group-picker-bottom',
        kind: 'group-picker',
      })
    }

    tailMessages.value.forEach((entry, index) => {
      blocks.push({
        id: `tail-${index}`,
        kind: 'message',
        text: entry.text,
        who: normalizeWho(entry.who),
      })
    })

    if (isPennyLoading.value) {
      blocks.push({
        id: 'loading',
        kind: 'loading',
        loadingChat: analysis.loadingChat.value,
        status: pennyLoadingStatus.value,
      })
    }

    return blocks
  })

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

  function setFile(file: File) {
    revokePreview()
    previewUrl.value = URL.createObjectURL(file)
  }

  function stopVoiceStream() {
    if (!voiceStream.value) {
      return
    }

    voiceStream.value.getTracks().forEach((track: any) => track.stop())
    voiceStream.value = null
  }

  function invalidateVoiceRequests() {
    voiceRequestId.value += 1
  }

  function cancelVoiceInput() {
    invalidateVoiceRequests()
    voiceShouldTranscribe.value = false
    isTranscribingVoice.value = false

    if (voiceRecorder.value && voiceRecorder.value.state !== 'inactive') {
      voiceRecorder.value.stop()
      return
    }

    isRecordingVoice.value = false
    voiceRecorder.value = null
    stopVoiceStream()
  }

  function appendTranscriptToComposer(text: string) {
    const normalizedText = String(text || '').trim()

    if (!normalizedText) {
      return
    }

    const existingText = String(composerText.value || '').trim()
    composerText.value = existingText ? `${existingText} ${normalizedText}` : normalizedText
  }

  async function transcribeVoiceBlob(blob: Blob, requestId: number) {
    const groups = availableGroups.value
      .map((group: any) => String(group?.name || '').trim())
      .filter(Boolean)

    return await blobToBase64(blob).then(async (audioBase64) => {
      if (!audioBase64) {
        if (voiceRequestId.value === requestId) {
          voiceError.value = 'Could not read that voice note.'
        }

        return null
      }

      return await useOrpc().transcribeVoice({
        audioBase64,
        groupName: selectedGroup.value?.name || undefined,
        groups,
        mimeType: blob.type || voiceMimeType.value || 'audio/webm',
        people: splitPeople.value,
      }).then(
        (value: any) => {
          if (voiceRequestId.value !== requestId) {
            return null
          }

          const transcript = String(value?.text || '').trim()

          if (!transcript) {
            voiceError.value = 'Could not transcribe that voice note.'
            return null
          }

          voiceError.value = ''
          appendTranscriptToComposer(transcript)
          return transcript
        },
        (error: any) => {
          if (voiceRequestId.value === requestId) {
            voiceError.value = error?.message || 'Could not transcribe that voice note.'
          }

          return null
        },
      )
    }).finally(() => {
      if (voiceRequestId.value === requestId) {
        isTranscribingVoice.value = false
      }
    })
  }

  function stopVoiceInput() {
    if (!voiceRecorder.value || voiceRecorder.value.state === 'inactive') {
      return
    }

    voiceRecorder.value.stop()
  }

  function startVoiceInput() {
    if (!canRecordVoice.value || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return
    }

    voiceError.value = ''

    navigator.mediaDevices.getUserMedia({ audio: true }).then(
      (stream) => {
        const recorder = voiceMimeType.value
          ? new MediaRecorder(stream, { mimeType: voiceMimeType.value })
          : new MediaRecorder(stream)
        const chunks: Blob[] = []

        voiceRecorder.value = recorder
        voiceShouldTranscribe.value = true
        voiceStream.value = stream
        isRecordingVoice.value = true

        recorder.ondataavailable = (event: any) => {
          if (event.data?.size) {
            chunks.push(event.data)
          }
        }

        recorder.onerror = () => {
          voiceShouldTranscribe.value = false
          voiceError.value = 'Could not record audio.'

          if (recorder.state !== 'inactive') {
            recorder.stop()
          }
        }

        recorder.onstop = () => {
          const shouldTranscribe = voiceShouldTranscribe.value
          const audioBlob = new Blob(chunks, {
            type: recorder.mimeType || voiceMimeType.value || 'audio/webm',
          })

          voiceRecorder.value = null
          voiceShouldTranscribe.value = false
          isRecordingVoice.value = false
          stopVoiceStream()

          if (!shouldTranscribe) {
            return
          }

          if (!audioBlob.size) {
            voiceError.value = 'Voice note was empty.'
            return
          }

          const requestId = voiceRequestId.value + 1
          voiceRequestId.value = requestId
          isTranscribingVoice.value = true
          void transcribeVoiceBlob(audioBlob, requestId)
        }

        recorder.start()
      },
      () => {
        voiceError.value = 'Microphone access was blocked.'
      },
    )
  }

  function toggleVoiceInput() {
    if (isTranscribingVoice.value) {
      return
    }

    voiceError.value = ''

    if (isRecordingVoice.value) {
      stopVoiceInput()
      return
    }

    startVoiceInput()
  }

  function pushLocalMessage(who: string, text: string) {
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
    cancelVoiceInput()
    autoQuestionKey.value = ''
    composerText.value = ''
    composerSeedKey.value = ''
    groupCleared.value = false
    leadMessages.value = []
    tailMessages.value = []
    voiceError.value = ''
    clearInputs()
    revokePreview()
  }

  function initializeFreshScan() {
    resetDraftInputs()
    const queryGroupId = getQueryGroupId()
    localGroupId.value = availableGroups.value.some((group: any) => group.id === queryGroupId)
      ? queryGroupId
      : ''
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

  function onFileChange(event: any) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setFile(file)
    void startFileAnalysis(file)
  }

  async function onPickGroup(group: any) {
    if (parsedReceipt.value) {
      groupCleared.value = false
      localGroupId.value = group.id
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

  async function hydrateSavedChat(nextChatId: string) {
    const normalizedChatId = String(nextChatId || '').trim()

    if (!normalizedChatId) {
      return null
    }

    cancelVoiceInput()
    voiceError.value = ''
    composerText.value = ''
    clearInputs()
    const loadedChat = await analysis.loadChat(normalizedChatId)
    const loadedGroupId = String(loadedChat?.groupId || '').trim()

    if (loadedGroupId && availableGroups.value.some((group: any) => group.id === loadedGroupId)) {
      groupCleared.value = false
      localGroupId.value = loadedGroupId
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

    const nextDraft = buildScanBillComposerDraft({
      chatId: analysis.chatId.value,
      group: selectedGroup.value,
      receipt: parsedReceipt.value,
      result: analysis.result.value,
    })

    if (!nextDraft) {
      return false
    }

    if (composerSeedKey.value === nextDraft.seedKey) {
      return true
    }

    stageBillComposerDraft(nextDraft.draft)
    composerSeedKey.value = nextDraft.seedKey
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
    composerSeedKey.value = ''
    const hasDraft = await continueToSplit()

    if (!hasDraft) {
      return
    }

    await navigateTo(`/groups/${group.id}/bills/new`)
  }

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

    if (availableGroups.value.some((group: any) => group.id === normalizedGroupId)) {
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
    supportsVoiceInput.value = Boolean(typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined')
    voiceMimeType.value = pickSupportedAudioMimeType()
  })

  onBeforeUnmount(() => {
    cancelVoiceInput()
    revokePreview()
    analysis.stop()
  })

  return {
    cameraInput,
    canPickReceipt,
    canRecordVoice,
    canReset,
    canSend,
    clearGroup,
    composerPlaceholder,
    composerText,
    headerStatus,
    isRecordingVoice,
    isTranscribingVoice,
    onFileChange,
    onPickGroupId,
    onSend,
    openBillComposerFromScan,
    openReceiptPicker,
    fileInput,
    resetScan,
    selectedGroup,
    showShellTitle,
    showVoiceButton,
    toggleVoiceInput,
    transcriptBlocks,
    uploadLabel,
    voiceStatusLabel,
  }
}
