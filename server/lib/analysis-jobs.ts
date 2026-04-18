import { randomUUID } from 'node:crypto'

type Subscriber = (event: any) => void

type ActiveJob = {
  chatId: string
  done: boolean
  id: string
  subscribers: Set<Subscriber>
}

const jobsById = new Map<string, ActiveJob>()
const jobIdByChatId = new Map<string, string>()

function createSubscription(job: ActiveJob, initialEvents: any[] = []) {
  return (async function* () {
    const queue = [...initialEvents]
    let waitForEvent: null | (() => void) = null

    const subscriber: Subscriber = (event) => {
      queue.push(event)
      waitForEvent?.()
      waitForEvent = null
    }

    job.subscribers.add(subscriber)

    try {
      while (!job.done || queue.length) {
        if (!queue.length) {
          await new Promise<void>((resolve) => {
            waitForEvent = resolve
          })
          continue
        }

        yield queue.shift()
      }
    } finally {
      job.subscribers.delete(subscriber)
    }
  })()
}

function emit(job: ActiveJob, event: any) {
  if (event?.type === 'chat_started' && event.chatId) {
    if (job.chatId) {
      jobIdByChatId.delete(job.chatId)
    }

    job.chatId = String(event.chatId || '').trim()

    if (job.chatId) {
      jobIdByChatId.set(job.chatId, job.id)
    }
  }

  for (const subscriber of job.subscribers) {
    subscriber(event)
  }
}

function finish(job: ActiveJob) {
  job.done = true

  if (job.chatId) {
    jobIdByChatId.delete(job.chatId)
  }

  jobsById.delete(job.id)
}

export function startAnalysisJob(run: (push: (event: any) => void) => Promise<any>) {
  const job: ActiveJob = {
    chatId: '',
    done: false,
    id: randomUUID(),
    subscribers: new Set(),
  }

  jobsById.set(job.id, job)

  void run((event) => {
    emit(job, event)
  })
    .then((result) => {
      emit(job, {
        type: 'complete',
        result,
      })
      finish(job)
    })
    .catch((error: any) => {
      emit(job, {
        type: 'error',
        message: error?.message || 'The streamed analysis job failed.',
      })
      finish(job)
    })

  return createSubscription(job, [{
    type: 'status',
    phase: 'queued',
    message: 'Penny is warming up her little receipt engine.',
  }])
}

export function attachToAnalysisJob(chatId: string) {
  const normalizedChatId = String(chatId || '').trim()
  const jobId = jobIdByChatId.get(normalizedChatId)

  if (!jobId) {
    return null
  }

  const job = jobsById.get(jobId)

  if (!job || job.done) {
    if (job?.chatId) {
      jobIdByChatId.delete(job.chatId)
    }

    if (job) {
      jobsById.delete(job.id)
    }

    return null
  }

  return createSubscription(job)
}
