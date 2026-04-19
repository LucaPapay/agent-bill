import { runPennyChat } from './run'

export async function* streamPennyChat(input: any, personId: string) {
  const queue = [{
    type: 'status',
    phase: 'queued',
    message: 'Penny is warming up her little receipt engine.',
  }] as any[]
  let done = false
  let waitForEvent: null | (() => void) = null

  const push = (event: any) => {
    queue.push(event)
    waitForEvent?.()
    waitForEvent = null
  }

  void runPennyChat(input, personId, push)
    .then((result) => {
      push({
        type: 'complete',
        result,
      })
    })
    .catch((error: any) => {
      push({
        type: 'error',
        message: error?.message || 'The Penny stream failed.',
      })
    })
    .finally(() => {
      done = true
      waitForEvent?.()
      waitForEvent = null
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
