import { consumeEventIterator } from '@orpc/client'

let currentCancel: any = null

function normalizeText(value: any) {
  return String(value || '').trim()
}

function isRunningStatus(status: any) {
  return ['agent', 'extracting', 'queued', 'running', 'starting'].includes(status)
}

function createEmptyContext() {
  return {
    messages: [],
    status: 'idle',
  }
}

function readLatestMessageData(messages: any[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const data = messages[index]?.data

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data
    }
  }

  return {}
}

function appendToolMessage(messages: any[], toolName: any) {
  const normalizedToolName = normalizeText(toolName)

  if (!normalizedToolName) {
    return messages
  }

  return [...messages, {
    data: {
      state: 'running',
      toolName: normalizedToolName,
    },
    role: 'assistant',
    text: '',
  }].slice(-120)
}

function finishToolMessage(messages: any[], toolName: any, state: any) {
  const normalizedToolName = normalizeText(toolName)

  if (!normalizedToolName) {
    return messages
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (message?.data?.toolName !== normalizedToolName || message?.data?.state !== 'running') {
      continue
    }

    return messages.map((entry: any, entryIndex: number) =>
      entryIndex === index
        ? {
            ...entry,
            data: {
              ...(entry.data || {}),
              state: state === 'error' ? 'error' : 'done',
            },
          }
        : entry,
    )
  }

  return [...messages, {
    data: {
      state: state === 'error' ? 'error' : 'done',
      toolName: normalizedToolName,
    },
    role: 'assistant',
    text: '',
  }].slice(-120)
}

function failRunningToolMessages(messages: any[]) {
  return messages.map((entry: any) =>
    entry?.data?.state === 'running'
      ? {
          ...entry,
          data: {
            ...(entry.data || {}),
            state: 'error',
          },
        }
      : entry,
  )
}

export function usePennyChat() {
  const context = useState<any>('penny-chat:context', createEmptyContext)
  const chatId = computed(() => normalizeText(context.value?.chatId))
  const messages = computed(() => Array.isArray(context.value?.messages) ? context.value.messages : [])

  function setContext(value: any) {
    context.value = value
      ? {
          ...value,
          messages: Array.isArray(value.messages) ? value.messages : [],
        }
      : createEmptyContext()
  }

  function patchContext(value: any) {
    setContext({
      ...(context.value || {}),
      ...value,
      messages: value?.messages === undefined
        ? messages.value
        : value.messages,
    })
  }

  function patchMessages(update: any) {
    patchContext({
      messages: update(messages.value),
    })
  }

  function stop() {
    const cancel = currentCancel

    currentCancel = null

    if (!cancel) {
      return
    }

    void cancel()
  }

  function reset() {
    stop()
    setContext(createEmptyContext())
  }

  function interruptRun() {
    if (!isRunningStatus(normalizeText(context.value?.status))) {
      return
    }

    patchMessages(failRunningToolMessages)
  }

  function applyEvent(event: any) {
    if (event.type === 'chat_started') {
      patchContext({
        chatId: normalizeText(event.chatId),
      })
      return
    }

    if (event.type === 'status') {
      patchContext({
        status: event.phase,
      })
      return
    }

    if (event.type === 'receipt_extracted') {
      patchContext({
        receipt: event.receipt || null,
      })
      return
    }

    if (event.type === 'agent_tool_start') {
      patchMessages((currentMessages: any[]) => appendToolMessage(currentMessages, event.toolName))
      return
    }

    if (event.type === 'agent_tool_end') {
      patchMessages((currentMessages: any[]) => finishToolMessage(currentMessages, event.toolName, event.isError ? 'error' : 'done'))
      return
    }

    if (event.type === 'complete') {
      setContext(event.result)
      stop()
      return
    }

    if (event.type === 'error') {
      interruptRun()
      patchContext({
        status: 'error',
        summary: normalizeText(event.message) || 'Something went wrong.',
      })
      stop()
    }
  }

  function openStream(stream: any) {
    stop()

    currentCancel = consumeEventIterator(stream, {
      onEvent: applyEvent,
      onError: (error) => {
        if (!isRunningStatus(normalizeText(context.value?.status))) {
          return
        }

        interruptRun()
        patchContext({
          status: 'error',
          summary: error?.message || 'The live analysis stream disconnected.',
        })
      },
      onFinish: () => {
        currentCancel = null
      },
    })
  }

  async function loadChat(nextChatId: any) {
    const normalizedChatId = normalizeText(nextChatId)

    if (!normalizedChatId) {
      reset()
      return null
    }

    if (chatId.value === normalizedChatId) {
      return context.value
    }

    stop()
    setContext({
      chatId: normalizedChatId,
      messages: [],
      status: 'loading',
    })

    return await useOrpc().getBillChat({ chatId: normalizedChatId }).then(
      (value) => {
        setContext(value)
        return value
      },
      (error) => {
        setContext({
          messages: [],
          status: 'error',
          summary: error?.message || 'Could not load that saved split chat.',
        })
        return null
      },
    )
  }

  async function sendMessages(nextMessages: any[], options: any = {}) {
    if (!Array.isArray(nextMessages) || !nextMessages.length) {
      return null
    }

    if (options.resetChat) {
      reset()
    } else {
      interruptRun()
      stop()
    }

    const latestMessageData = readLatestMessageData(nextMessages)

    patchContext({
      chatId: options.resetChat ? '' : chatId.value,
      groupId: normalizeText(latestMessageData.groupId) || context.value?.groupId || '',
      messages: [...messages.value, ...nextMessages].slice(-120),
      people: Array.isArray(latestMessageData.people) && latestMessageData.people.length
        ? latestMessageData.people
        : context.value?.people || [],
      status: 'starting',
      summary: '',
      title: normalizeText(latestMessageData.title) || context.value?.title || '',
    })

    openStream(useOrpc().chatStream({
      chatId: options.resetChat ? undefined : chatId.value || undefined,
      messages: nextMessages,
    }))

    return null
  }

  return {
    chatId,
    context,
    loadChat,
    messages,
    reset,
    sendMessages,
    stop,
  }
}
