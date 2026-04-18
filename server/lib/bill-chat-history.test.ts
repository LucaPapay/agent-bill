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
  it('turns streamed agent events into persisted history entries', () => {
    const history: Array<{ text: string; who: string }> = []

    expect(
      appendBillChatEvent(
        appendBillChatEvent(
          appendBillChatEvent(history, {
            message: 'Analysis job queued.',
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
        text: 'Analysis job queued.',
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
