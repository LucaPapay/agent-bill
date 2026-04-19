import { computed, ref } from 'vue'

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

export function useScanVoiceInput({
  getAvailableGroups,
  getCanRecordVoice,
  getGroupName,
  getPeople,
  onTranscript,
}: {
  getAvailableGroups: () => any[]
  getCanRecordVoice: () => boolean
  getGroupName: () => string
  getPeople: () => string[]
  onTranscript: (text: string) => void
}) {
  const voiceMimeType = ref('')
  const voiceError = ref('')
  const voiceRecorder = ref<any>(null)
  const voiceRequestId = ref(0)
  const voiceShouldTranscribe = ref(false)
  const voiceStream = ref<any>(null)
  const isRecordingVoice = ref(false)
  const isTranscribingVoice = ref(false)
  const supportsVoiceInput = ref(false)
  const canRecordVoice = computed(() => Boolean(getCanRecordVoice()))
  const showVoiceButton = computed(() => supportsVoiceInput.value || isRecordingVoice.value || isTranscribingVoice.value)
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

  async function transcribeVoiceBlob(blob: Blob, requestId: number) {
    const groups = getAvailableGroups()
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
        groupName: getGroupName() || undefined,
        groups,
        mimeType: blob.type || voiceMimeType.value || 'audio/webm',
        people: getPeople(),
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
          onTranscript(transcript)
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

  function setup() {
    supportsVoiceInput.value = Boolean(typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined')
    voiceMimeType.value = pickSupportedAudioMimeType()
  }

  function teardown() {
    cancelVoiceInput()
  }

  return {
    canRecordVoice,
    isRecordingVoice,
    isTranscribingVoice,
    setup,
    showVoiceButton,
    teardown,
    toggleVoiceInput,
    voiceError,
    voiceStatusLabel,
  }
}
