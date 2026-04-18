import { randomUUID } from 'node:crypto'
import { runPennyAnalysis, runPennyRevision } from './pipeline'

type Subscriber = (event: any) => void

type ActiveStream = {
  chatId: string
  done: boolean
  id: string
  subscribers: Set<Subscriber>
}

const streamsById = new Map<string, ActiveStream>()
const streamIdByChatId = new Map<string, string>()

function createSubscription(stream: ActiveStream, initialEvents: any[] = []) {
  return (async function* () {
    const queue = [...initialEvents]
    let waitForEvent: null | (() => void) = null

    const subscriber: Subscriber = (event) => {
      queue.push(event)
      waitForEvent?.()
      waitForEvent = null
    }

    stream.subscribers.add(subscriber)

    try {
      while (!stream.done || queue.length) {
        if (!queue.length) {
          await new Promise<void>((resolve) => {
            waitForEvent = resolve
          })
          continue
        }

        yield queue.shift()
      }
    } finally {
      stream.subscribers.delete(subscriber)
    }
  })()
}

function emit(stream: ActiveStream, event: any) {
  if (event?.type === 'chat_started' && event.chatId) {
    if (stream.chatId) {
      streamIdByChatId.delete(stream.chatId)
    }

    stream.chatId = String(event.chatId || '').trim()

    if (stream.chatId) {
      streamIdByChatId.set(stream.chatId, stream.id)
    }
  }

  for (const subscriber of stream.subscribers) {
    subscriber(event)
  }
}

function finish(stream: ActiveStream) {
  stream.done = true

  if (stream.chatId) {
    streamIdByChatId.delete(stream.chatId)
  }

  streamsById.delete(stream.id)
}

function startPennyStream(run: (push: (event: any) => void) => Promise<any>) {
  const stream: ActiveStream = {
    chatId: '',
    done: false,
    id: randomUUID(),
    subscribers: new Set(),
  }

  streamsById.set(stream.id, stream)

  void run((event) => {
    emit(stream, event)
  })
    .then((result) => {
      emit(stream, {
        type: 'complete',
        result,
      })
      finish(stream)
    })
    .catch((error: any) => {
      emit(stream, {
        type: 'error',
        message: error?.message || 'The Penny stream failed.',
      })
      finish(stream)
    })

  return createSubscription(stream, [{
    type: 'status',
    phase: 'queued',
    message: 'Penny is warming up her little receipt engine.',
  }])
}

function attachToPennyStream(chatId: string) {
  const normalizedChatId = String(chatId || '').trim()
  const streamId = streamIdByChatId.get(normalizedChatId)

  if (!streamId) {
    return null
  }

  const stream = streamsById.get(streamId)

  if (!stream || stream.done) {
    if (stream?.chatId) {
      streamIdByChatId.delete(stream.chatId)
    }

    if (stream) {
      streamsById.delete(stream.id)
    }

    return null
  }

  return createSubscription(stream)
}

export async function* streamPennyAnalysis(input: any, personId: string) {
  yield* startPennyStream((push) => runPennyAnalysis(input, personId, push))
}

export async function* streamPennyRevision(input: any, personId: string) {
  yield* startPennyStream((push) => runPennyRevision(input, personId, push))
}

export async function* streamExistingPennyChat(chatId: string) {
  const subscription = attachToPennyStream(chatId)

  if (!subscription) {
    return
  }

  yield* subscription
}
