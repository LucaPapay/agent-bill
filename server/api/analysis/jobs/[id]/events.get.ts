import { createError, createEventStream, getRouterParam } from 'h3'
import { getAnalysisJob, subscribeToAnalysisJob } from '../../../../lib/analysis-jobs'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing analysis job id.',
    })
  }

  const job = getAnalysisJob(id)

  if (!job) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Analysis job not found.',
    })
  }

  const stream = createEventStream(event)

  const unsubscribe = subscribeToAnalysisJob(id, async (payload) => {
    await stream.push({
      event: 'update',
      data: JSON.stringify(payload),
    })

    if (payload.type === 'complete' || payload.type === 'error') {
      setTimeout(() => {
        unsubscribe?.()
        void stream.close()
      }, 50)
    }
  })

  stream.onClosed(() => {
    unsubscribe?.()
  })

  await stream.send()
})
