import { consumeEventIterator } from '@orpc/client'

let currentCancel: null | (() => Promise<void>) = null

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

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function isRunningStatus(status: string) {
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

export function usePennyChat() {
  const context = useState<any>('penny-chat:context', createEmptyContext)
  const chatId = computed(() => normalizeText(context.value?.chatId))
  const error = computed(() =>
    normalizeText(context.value?.status) === 'error'
      ? normalizeText(context.value?.summary)
      : '',
  )
  const messages = computed(() =>
    Array.isArray(context.value?.messages)
      ? context.value.messages
      : [],
  )

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

  function stop() {
    if (!currentCancel) {
      return
    }

    void currentCancel()
    currentCancel = null
  }

  function reset() {
    stop()
    setContext(createEmptyContext())
  }

  function appendToolMessage(toolName: string) {
    const normalizedToolName = normalizeText(toolName)

    if (!normalizedToolName) {
      return
    }

    patchContext({
      messages: [...messages.value, {
        data: {
          state: 'running',
          toolName: normalizedToolName,
        },
        role: 'assistant',
        text: '',
      }].slice(-120),
    })
  }

  function updateToolMessage(toolName: string, state: string) {
    const normalizedToolName = normalizeText(toolName)

    if (!normalizedToolName) {
      return
    }

    for (let index = messages.value.length - 1; index >= 0; index -= 1) {
      const entry = messages.value[index]

      if (entry?.data?.toolName !== normalizedToolName || entry?.data?.state !== 'running') {
        continue
      }

      patchContext({
        messages: messages.value.map((item: any, itemIndex: number) =>
          itemIndex === index
            ? {
                ...item,
                data: {
                  ...(item.data || {}),
                  state: state === 'error' ? 'error' : 'done',
                },
              }
            : item,
        ),
      })
      return
    }

    patchContext({
      messages: [...messages.value, {
        data: {
          state: state === 'error' ? 'error' : 'done',
          toolName: normalizedToolName,
        },
        role: 'assistant',
        text: '',
      }].slice(-120),
    })
  }

  function failRunningToolMessages() {
    patchContext({
      messages: messages.value.map((entry: any) =>
        entry?.data?.state === 'running'
          ? {
              ...entry,
              data: {
                ...(entry.data || {}),
                state: 'error',
              },
            }
          : entry,
      ),
    })
  }

  function interruptRun() {
    if (!isRunningStatus(normalizeText(context.value?.status))) {
      return
    }

    failRunningToolMessages()
  }

  function applyResult(value: any) {
    setContext(value)
  }

  function applyPayload(payload: any) {
    if (payload.type === 'chat_started') {
      patchContext({
        chatId: normalizeText(payload.chatId),
      })
      return
    }

    if (payload.type === 'status') {
      patchContext({
        status: payload.phase,
      })
      return
    }

    if (payload.type === 'receipt_extracted') {
      patchContext({
        receipt: payload.receipt || null,
      })
      return
    }

    if (payload.type === 'agent_tool_start') {
      appendToolMessage(payload.toolName)
      return
    }

    if (payload.type === 'agent_tool_end') {
      updateToolMessage(payload.toolName, payload.isError ? 'error' : 'done')
      return
    }

    if (payload.type === 'complete') {
      applyResult(payload.result)
      stop()
      return
    }

    if (payload.type === 'error') {
      failRunningToolMessages()
      patchContext({
        status: 'error',
        summary: normalizeText(payload.message) || 'Something went wrong.',
      })
      stop()
    }
  }

  function openStream(stream: any) {
    stop()

    currentCancel = consumeEventIterator(stream, {
      onEvent: applyPayload,
      onError: (streamError: any) => {
        if (!isRunningStatus(normalizeText(context.value?.status))) {
          return
        }

        failRunningToolMessages()
        patchContext({
          status: 'error',
          summary: streamError?.message || 'The live analysis stream disconnected.',
        })
      },
      onFinish: () => {
        currentCancel = null
      },
    })
  }

  async function loadChat(nextChatId: string) {
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
      (value: any) => {
        applyResult(value)
        return value
      },
      (loadError: any) => {
        setContext({
          messages: [],
          status: 'error',
          summary: loadError?.message || 'Could not load that saved split chat.',
        })
        return null
      },
    )
  }

  async function sendMessages(nextMessages: any[], options: { resetChat?: boolean } = {}) {
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

  async function start(input: any) {
    return await sendMessages([{
      data: {
        groupId: normalizeText(input?.groupId) || undefined,
        imageBase64: normalizeText(input?.imageBase64) || undefined,
        mimeType: normalizeText(input?.mimeType) || undefined,
        people: Array.isArray(input?.people) ? input.people : [],
        rawText: normalizeText(input?.rawText) || undefined,
        title: normalizeText(input?.title) || undefined,
      },
      role: 'user',
      text: normalizeText(input?.text),
    }], {
      resetChat: true,
    })
  }

  async function startFromFile({
    file,
    groupId = '',
    title,
    people = [],
  }: {
    file: File
    groupId?: string
    title: string
    people?: string[]
  }) {
    return await start({
      groupId,
      imageBase64: await fileToBase64(file),
      mimeType: file.type || 'image/jpeg',
      people,
      title,
    })
  }

  async function revise(message: string, people: string[] = [], groupId = '') {
    const nextMessage = normalizeText(message)

    if (!nextMessage || !chatId.value || !context.value?.receipt) {
      return null
    }

    return await sendMessages([{
      data: {
        groupId: normalizeText(groupId) || undefined,
        people,
      },
      role: 'user',
      text: nextMessage,
    }])
  }

  async function confirmGroupSelection(groupName: string, people: string[] = [], displayUserMessage = '', groupId = '') {
    const normalizedGroupName = normalizeText(groupName)

    if (!normalizedGroupName || !chatId.value || !context.value?.receipt) {
      return null
    }

    return await sendMessages([{
      data: {
        groupId: normalizeText(groupId) || undefined,
        people,
      },
      role: 'user',
      text: normalizeText(displayUserMessage || normalizedGroupName) || normalizedGroupName,
    }])
  }

  return {
    chatId,
    confirmGroupSelection,
    context,
    error,
    loadChat,
    messages,
    reset,
    revise,
    start,
    startFromFile,
    stop,
  }
}
