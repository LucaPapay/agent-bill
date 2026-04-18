import { describe, expect, it } from 'vitest'
import {
  appendBillChatEvent,
  appendBillChatReply,
  createBillChatSeed,
} from './bill-chat-history'

describe('createBillChatSeed', () => {
  it('creates a user seed message for receipt uploads', () => {
    expect(createBillChatSeed({
      imageBase64: 'abc',
      title: 'Friday dinner',
    })).toEqual([
      {
        text: 'Uploaded a receipt for Friday dinner.',
        who: 'user',
      },
    ])
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
  it('turns streamed agent events into persisted history entries', () => {
    const history = [
      {
        text: 'Uploaded a receipt for Friday dinner.',
        who: 'user',
      },
    ]

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
        text: 'Uploaded a receipt for Friday dinner.',
        who: 'user',
      },
      {
        text: 'Penny is warming up her little receipt engine.',
        who: 'log',
      },
      {
        text: 'Penny is reading the receipt.',
        who: 'penny',
      },
      {
        text: 'Split ready.',
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
