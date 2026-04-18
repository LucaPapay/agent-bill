import { runBillAnalysisPipeline } from './bill-pipeline'

export async function* streamBillAnalysis(input: any) {
  const queue: any[] = [{
    type: 'status',
    phase: 'queued',
    message: 'Analysis job queued.',
  }]
  let done = false
  let waitForEvent: null | (() => void) = null

  function push(event: any) {
    queue.push(event)
    waitForEvent?.()
    waitForEvent = null
  }

  void runBillAnalysisPipeline(input, push)
    .then((result) => {
      done = true
      push({
        type: 'complete',
        result,
      })
    })
    .catch((error: any) => {
      done = true
      push({
        type: 'error',
        message: error?.message || 'The streamed analysis job failed.',
      })
    })

  while (!done || queue.length) {
    if (!queue.length) {
      await new Promise<void>((resolve) => {
        waitForEvent = resolve
      })
      continue
    }

    yield queue.shift()
  }
}
