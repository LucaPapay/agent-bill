import { consumeEventIterator } from '@orpc/client'

let currentCancel: null | (() => Promise<void>) = null
let pollTimer: null | ReturnType<typeof setTimeout> = null

function isPendingResult(value: any) {
  const source = String(value?.source || '').trim()
  return source === 'pi-agent-pending' || source === 'receipt-pending'
}

function trimFeed(feed: Array<{ text: string; who: string }>, entry: { text: string; who: string }) {
  return [...feed, entry].slice(-120)
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.split(',')[1] || '' : value)
    }

    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

export function useBillAnalysisStream() {
  const assistantText = useState('bill-analysis:assistant-text', () => '')
  const chatId = useState('bill-analysis:chat-id', () => '')
  const error = useState('bill-analysis:error', () => '')
  const feed = useState<Array<{ text: string; who: string }>>('bill-analysis:feed', () => [])
  const jobId = useState('bill-analysis:job-id', () => '')
  const loadingChat = useState('bill-analysis:loading-chat', () => false)
  const receipt = useState<any>('bill-analysis:receipt', () => null)
  const recentChats = useState<any[]>('bill-analysis:recent-chats', () => [])
  const result = useState<any>('bill-analysis:result', () => null)
  const status = useState('bill-analysis:status', () => 'idle')

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  function stop() {
    if (currentCancel) {
      void currentCancel()
      currentCancel = null
    }

    stopPolling()
  }

  function clearCurrent() {
    assistantText.value = ''
    chatId.value = ''
    error.value = ''
    feed.value = []
    jobId.value = ''
    receipt.value = null
    result.value = null
    status.value = 'idle'
  }

  function reset() {
    stop()
    clearCurrent()
  }

  function pushFeed(who: string, text: string) {
    feed.value = trimFeed(feed.value, { text, who })
  }

  function applyResult(nextResult: any) {
    assistantText.value = ''
    chatId.value = nextResult?.chatId || ''
    error.value = ''
    feed.value = Array.isArray(nextResult?.history) ? nextResult.history : []
    jobId.value = nextResult?.runId || ''
    receipt.value = nextResult?.receipt || null
    result.value = nextResult
    status.value = isPendingResult(nextResult) ? 'agent' : 'complete'

    if (status.value === 'complete') {
      stopPolling()
    }
  }

  function schedulePoll(nextChatId: string, delay = 1200) {
    stopPolling()

    if (!nextChatId) {
      return
    }

    pollTimer = setTimeout(() => {
      void useOrpc().getBillChat({ chatId: nextChatId }).then(
        (value: any) => {
          applyResult(value)

          if (isPendingResult(value)) {
            schedulePoll(nextChatId)
            return
          }

          void loadChats()
        },
        () => {
          schedulePoll(nextChatId, 2000)
        },
      )
    }, delay)
  }

  function openStream(stream: any) {
    currentCancel = consumeEventIterator(stream, {
      onEvent: (event) => {
        applyPayload(event)
      },
      onError: (streamError: any) => {
        if (status.value === 'complete' || status.value === 'error') {
          return
        }

        error.value = streamError?.message || 'The live analysis stream disconnected.'
        status.value = 'error'
        pushFeed('log', error.value)

        if (chatId.value) {
          schedulePoll(chatId.value, 800)
        }
      },
      onFinish: () => {
        currentCancel = null
      },
    })
  }

  function applyPayload(payload: any) {
    if (payload.type === 'chat_started') {
      chatId.value = payload.chatId
      return
    }

    if (payload.type === 'status') {
      status.value = payload.phase
      pushFeed(payload.phase === 'agent' ? 'penny' : 'log', payload.message)
      return
    }

    if (payload.type === 'receipt_extracted') {
      receipt.value = payload.receipt
      pushFeed(
        'log',
        `Penny parsed ${payload.receipt.items.length} items from ${payload.receipt.merchant || 'the receipt'}.`,
      )
      return
    }

    if (payload.type === 'agent_progress') {
      pushFeed('penny', payload.message)
      return
    }

    if (payload.type === 'agent_text_delta') {
      assistantText.value += payload.delta
      return
    }

    if (payload.type === 'agent_tool_start') {
      pushFeed('log', `Tool: ${payload.toolName}`)
      return
    }

    if (payload.type === 'complete') {
      applyResult(payload.result)
      stop()
      void loadChats()
      return
    }

    if (payload.type === 'error') {
      error.value = payload.message
      status.value = 'error'
      pushFeed('log', payload.message)
      stop()

      if (chatId.value) {
        schedulePoll(chatId.value, 800)
      }
    }
  }

  async function loadChats() {
    recentChats.value = await useOrpc().listBillChats()
    return recentChats.value
  }

  async function loadChat(nextChatId: string) {
    const normalizedChatId = String(nextChatId || '').trim()

    if (!normalizedChatId) {
      reset()
      return null
    }

    if (chatId.value === normalizedChatId && result.value?.chatId === normalizedChatId) {
      return result.value
    }

    stop()
    loadingChat.value = true
    error.value = ''
    status.value = 'starting'

    return await useOrpc().getBillChat({ chatId: normalizedChatId }).then(
      (value: any) => {
        applyResult(value)

        if (isPendingResult(value)) {
          schedulePoll(normalizedChatId)
        }

        return value
      },
      (loadError: any) => {
        clearCurrent()
        error.value = loadError?.message || 'Could not load that saved split chat.'
        status.value = 'error'
        return null
      },
    ).finally(() => {
      loadingChat.value = false
    })
  }

  async function start(input: any) {
    reset()
    status.value = 'starting'
    pushFeed('log', 'Opening analysis stream...')

    openStream(useOrpc().analyzeBillStream(input))

    return null
  }

  async function startFromFile({
    file,
    title,
  }: {
    file: File
    title: string
  }) {
    return await start({
      imageBase64: await fileToBase64(file),
      mimeType: file.type || 'image/jpeg',
      title,
    })
  }

  async function revise(message: string, people: string[] = []) {
    const nextMessage = String(message || '').trim()

    if (!nextMessage || !chatId.value || !receipt.value) {
      return null
    }

    stop()
    assistantText.value = ''
    error.value = ''
    status.value = 'starting'
    pushFeed('user', nextMessage)
    pushFeed('log', 'Penny is revising the split...')

    openStream(useOrpc().reviseBillSplitStream({
      chatId: chatId.value,
      message: nextMessage,
      people,
    }))

    return null
  }

  return {
    assistantText,
    chatId,
    error,
    feed,
    jobId,
    loadChat,
    loadChats,
    loadingChat,
    receipt,
    recentChats,
    reset,
    result,
    revise,
    start,
    startFromFile,
    status,
    stop,
  }
}
