import { describe, expect, it } from 'vitest'
import {
  appendBillChatEvent,
  appendBillChatReply,
  createBillChatSeed,
} from './bill-chat-history'

describe('createBillChatSeed', () => {
  it('does not create a synthetic seed message for receipt uploads', () => {
    expect(createBillChatSeed({
      imageBase64: 'abc',
      title: 'Friday dinner',
    })).toEqual([])
  })
})

describe('appendBillChatReply', () => {
  it('appends the next user follow-up message', () => {
    expect(appendBillChatReply([], 'Sarah had the dessert')).toEqual([
      {
        text: 'Sarah had the dessert',
        who: 'user',
      },
    ])
  })
})

describe('appendBillChatEvent', () => {
  it('persists only visible chat entries from the stream', () => {
    const history: Array<{ text: string; who: string }> = []

    expect(
        appendBillChatEvent(
          appendBillChatEvent(
            appendBillChatEvent(history, {
            message: 'Penny is warming up her little receipt engine.',
            phase: 'queued',
            type: 'status',
          }),
          {
            message: 'Penny is reading the receipt.',
            type: 'agent_progress',
          },
        ),
        {
          result: {
            summary: 'Split ready.',
          },
          type: 'complete',
        },
      ),
    ).toEqual([
      {
        text: 'Split ready.',
        who: 'penny',
      },
    ])
  })

  it('persists a plain Penny reply without duplicating the final summary', () => {
    expect(
      appendBillChatEvent(
        appendBillChatEvent([], {
          type: 'assistant_message',
          message: 'Sarah covered the spritz, so the dessert stays shared.',
        }),
        {
          result: {
            summary: 'Sarah covered the spritz, so the dessert stays shared.',
          },
          type: 'complete',
        },
      ),
    ).toEqual([
      {
        text: 'Sarah covered the spritz, so the dessert stays shared.',
        who: 'penny',
      },
    ])
  })

  it('persists backend errors as log entries', () => {
    expect(appendBillChatEvent([], {
      type: 'error',
      message: 'The Pi agent loop failed before the split finished.',
    })).toEqual([
      {
        text: 'The Pi agent loop failed before the split finished.',
        who: 'log',
      },
    ])
  })
})
