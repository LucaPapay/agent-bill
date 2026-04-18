let currentSource: EventSource | null = null

function trimFeed(feed: Array<{ text: string; who: string }>, entry: { text: string; who: string }) {
  return [...feed, entry].slice(-10)
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
  const error = useState('bill-analysis:error', () => '')
  const feed = useState<Array<{ text: string; who: string }>>('bill-analysis:feed', () => [])
  const jobId = useState('bill-analysis:job-id', () => '')
  const receipt = useState<any>('bill-analysis:receipt', () => null)
  const result = useState<any>('bill-analysis:result', () => null)
  const status = useState('bill-analysis:status', () => 'idle')

  function stop() {
    if (currentSource) {
      currentSource.close()
      currentSource = null
    }
  }

  function reset() {
    stop()
    assistantText.value = ''
    error.value = ''
    feed.value = []
    jobId.value = ''
    receipt.value = null
    result.value = null
    status.value = 'idle'
  }

  function pushFeed(who: string, text: string) {
    feed.value = trimFeed(feed.value, { text, who })
  }

  function applyPayload(payload: any) {
    if (payload.type === 'status') {
      status.value = payload.phase
      pushFeed(payload.phase === 'agent' ? 'penny' : 'log', payload.message)
      return
    }

    if (payload.type === 'receipt_extracted') {
      receipt.value = payload.receipt
      pushFeed(
        'log',
        `OpenAI extracted ${payload.receipt.items.length} items from ${payload.receipt.merchant || 'the receipt'}.`,
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
      result.value = payload.result
      receipt.value = payload.result.receipt || receipt.value
      status.value = 'complete'
      pushFeed('penny', payload.result.summary || 'Split ready.')
      stop()
      return
    }

    if (payload.type === 'error') {
      error.value = payload.message
      status.value = 'error'
      pushFeed('log', payload.message)
      stop()
    }
  }

  async function start(input: any) {
    reset()
    status.value = 'starting'
    pushFeed('log', 'Opening analysis stream...')

    const job = await $fetch<{ id: string; streamUrl: string }>('/api/analysis/jobs', {
      method: 'POST',
      body: input,
    })

    jobId.value = job.id
    currentSource = new EventSource(job.streamUrl)

    currentSource.addEventListener('update', (event) => {
      applyPayload(JSON.parse((event as MessageEvent).data))
    })

    currentSource.onerror = () => {
      if (status.value !== 'complete' && status.value !== 'error') {
        error.value = 'The live analysis stream disconnected.'
        status.value = 'error'
        pushFeed('log', error.value)
      }

      stop()
    }

    return job
  }

  async function startFromFile({
    file,
    people,
    title,
  }: {
    file: File
    people: string[]
    title: string
  }) {
    return await start({
      imageBase64: await fileToBase64(file),
      mimeType: file.type || 'image/jpeg',
      people,
      title,
    })
  }

  return {
    assistantText,
    error,
    feed,
    jobId,
    receipt,
    reset,
    result,
    start,
    startFromFile,
    status,
    stop,
  }
}
