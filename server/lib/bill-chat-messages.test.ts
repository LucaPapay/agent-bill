import { describe, expect, it } from 'vitest'
import {
  appendBillChatAssistantMessage,
  appendBillChatMessages,
  appendBillChatToolMessage,
  failRunningBillChatToolMessages,
  updateBillChatToolMessage,
} from './bill-chat-messages'

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

describe('tool messages', () => {
  it('stores tool calls as normal assistant messages', () => {
    const messages = appendBillChatToolMessage([], 'extract_receipt')

    expect(messages).toEqual([{
      data: {
        state: 'running',
        toolName: 'extract_receipt',
      },
      role: 'assistant',
      text: '',
    }])
  })

  it('updates the latest running tool message', () => {
    const messages = updateBillChatToolMessage([{
      data: {
        state: 'running',
        toolName: 'extract_receipt',
      },
      role: 'assistant',
      text: '',
    }], 'extract_receipt', 'done')

    expect(messages).toEqual([{
      data: {
        state: 'done',
        toolName: 'extract_receipt',
      },
      role: 'assistant',
      text: '',
    }])
  })

  it('marks all running tool messages as failed', () => {
    const messages = failRunningBillChatToolMessages([
      {
        data: {
          state: 'running',
          toolName: 'extract_receipt',
        },
        role: 'assistant',
        text: '',
      },
      {
        data: {},
        role: 'user',
        text: 'retry',
      },
    ])

    expect(messages).toEqual([
      {
        data: {
          state: 'error',
          toolName: 'extract_receipt',
        },
        role: 'assistant',
        text: '',
      },
      {
        data: {},
        role: 'user',
        text: 'retry',
      },
    ])
  })
})
