import { describe, expect, it } from 'vitest'
import {
  normalizePeople,
  readSavedRunPayload,
  withRunMetadata,
} from './bill-run-payload'

describe('normalizePeople', () => {
  it('keeps plain arrays from persisted chat rows', () => {
    expect(normalizePeople([' Jojo ', 'Sarah', ''])).toEqual([
      'Jojo',
      'Sarah',
    ])
  })
})

describe('readSavedRunPayload', () => {
  it('returns the canonical top-level chat state', () => {
    const result = readSavedRunPayload({
      chatId: 'chat-1',
      messages: [{
        data: {},
        role: 'user',
        text: 'Please retry the split',
      }],
      people: ['Jojo', 'Sarah'],
      receipt: null,
      source: 'penny-pending',
      split: [],
      status: 'running',
      summary: 'Penny is working on the receipt.',
      title: 'Dinner receipt',
    })

    expect(result).toMatchObject({
      billItems: [],
      chatId: 'chat-1',
      messages: [{
        data: {},
        role: 'user',
        text: 'Please retry the split',
      }],
      people: ['Jojo', 'Sarah'],
      source: 'penny-pending',
      split: [],
      status: 'running',
      summary: 'Penny is working on the receipt.',
      title: 'Dinner receipt',
    })
    expect(result.receipt).toBeUndefined()
  })

  it('ignores dropped legacy fallback fields', () => {
    const result = readSavedRunPayload({
      context: {
        currency: 'USD',
        groupId: 'group-1',
        status: 'needs_input',
      },
      history: [{
        text: 'Use the dinner group',
        who: 'user',
      }],
      title: 'Dinner receipt',
    })

    expect(result.currency).toBe('EUR')
    expect(result.groupId).toBeUndefined()
    expect(result.status).toBe('ready')
    expect(result.messages).toEqual([])
  })
})

describe('withRunMetadata', () => {
  it('returns schema-safe analysis results for persisted chats', () => {
    const result = withRunMetadata({
      created_at: '2026-04-18T12:14:32.000Z',
      id: 'run-1',
      payload: {
        billDate: '',
        chatId: 'chat-1',
        currency: 'EUR',
        items: [],
        merchant: 'Dinner receipt',
        messages: [],
        notes: [],
        openai: {
          model: null,
          used: false,
        },
        people: ['Jojo', 'Sarah'],
        penny: {
          model: null,
          used: false,
        },
        receipt: null,
        source: 'penny-pending',
        split: [],
        status: 'running',
        summary: 'Penny is working on the receipt.',
        taxCents: 0,
        tipCents: 0,
        title: 'Dinner receipt',
        totalCents: 0,
      },
    })

    expect(result.receipt).toBeUndefined()
    expect('receipt' in result).toBe(false)
    expect(result.runId).toBe('run-1')
    expect(result.savedAt).toBe('2026-04-18T12:14:32.000Z')
    expect(result.chatId).toBe('chat-1')
    expect(result.status).toBe('running')
  })
})
