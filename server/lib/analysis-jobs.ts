import { randomUUID } from 'node:crypto'
import { runBillAnalysisPipeline } from './bill-pipeline'

const jobs = new Map<string, {
  done: boolean
  events: any[]
  id: string
  listeners: Set<(payload: any) => void | Promise<void>>
}>()

function emit(job: {
  done: boolean
  events: any[]
  id: string
  listeners: Set<(payload: any) => void | Promise<void>>
}, payload: any) {
  job.events.push(payload)

  if (job.events.length > 100) {
    job.events.shift()
  }

  for (const listener of job.listeners) {
    void listener(payload)
  }
}

function cleanupJobLater(id: string) {
  setTimeout(() => {
    jobs.delete(id)
  }, 10 * 60 * 1000)
}

export function getAnalysisJob(id: string) {
  return jobs.get(id) || null
}

export function subscribeToAnalysisJob(id: string, listener: (payload: any) => void | Promise<void>) {
  const job = jobs.get(id)

  if (!job) {
    return null
  }

  job.listeners.add(listener)

  for (const event of job.events) {
    void listener(event)
  }

  return () => {
    job.listeners.delete(listener)
  }
}

export function createAnalysisJob(input: any) {
  const job = {
    done: false,
    events: [],
    id: randomUUID(),
    listeners: new Set<(payload: any) => void | Promise<void>>(),
  }

  jobs.set(job.id, job)

  emit(job, {
    type: 'status',
    phase: 'queued',
    message: 'Analysis job queued.',
  })

  void (async () => {
    try {
      const result = await runBillAnalysisPipeline(input, (payload) => {
        emit(job, payload)
      })

      job.done = true

      emit(job, {
        type: 'complete',
        result,
      })
    } catch (error: any) {
      job.done = true

      emit(job, {
        type: 'error',
        message: error?.message || 'The streamed analysis job failed.',
      })
    } finally {
      cleanupJobLater(job.id)
    }
  })()

  return {
    id: job.id,
    streamUrl: `/api/analysis/jobs/${job.id}/events`,
  }
}
