import { describe, expect, it } from 'vitest'
import {
  appendBillChatAssistantMessage,
  appendBillChatMessages,
} from './bill-chat-history'

describe('appendBillChatMessages', () => {
  it('normalizes and appends user messages', () => {
    expect(appendBillChatMessages([], [{
      role: 'user',
      text: ' Sarah had the dessert ',
    }])).toEqual([
      {
        data: {},
        role: 'user',
        text: 'Sarah had the dessert',
      },
    ])
  })
})

describe('appendBillChatAssistantMessage', () => {
  it('does not duplicate the same trailing assistant message', () => {
    const messages = [{
      data: {},
      role: 'assistant',
      text: 'Split ready.',
    }]

    expect(appendBillChatAssistantMessage(messages, 'Split ready.')).toEqual(messages)
  })
})
