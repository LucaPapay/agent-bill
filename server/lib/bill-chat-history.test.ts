import { describe, expect, it } from 'vitest'
import {
  appendBillChatAssistantMessage,
  appendBillChatMessages,
  buildBillChatHistory,
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

describe('buildBillChatHistory', () => {
  it('derives visible chat history from messages', () => {
    expect(buildBillChatHistory([
      {
        data: {},
        role: 'user',
        text: 'Sarah had the dessert',
      },
      {
        data: {},
        role: 'assistant',
        text: 'Split ready.',
      },
    ])).toEqual([
      {
        text: 'Sarah had the dessert',
        who: 'user',
      },
      {
        text: 'Split ready.',
        who: 'penny',
      },
    ])
  })

  it('appends persisted errors as log entries', () => {
    expect(buildBillChatHistory([], 'Penny could not continue the chat.')).toEqual([
      {
        text: 'Penny could not continue the chat.',
        who: 'log',
      },
    ])
  })
})
