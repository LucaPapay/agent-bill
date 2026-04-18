import { describe, expect, it } from 'vitest'
import {
  normalizePeople,
  normalizeSavedRunPayload,
  withRunMetadata,
} from './bill-run-payload'

describe('normalizePeople', () => {
  it('accepts JSON-backed arrays from persisted chat rows', () => {
    expect(normalizePeople('[" Jojo ","Sarah",""]')).toEqual([
      'Jojo',
      'Sarah',
    ])
  })
})

describe('normalizeSavedRunPayload', () => {
  it('drops null receipts from pending checkpoint rows', () => {
    expect(normalizeSavedRunPayload({
      chatId: 'chat-1',
      people: ['Jojo', 'Sarah'],
      receipt: null,
      split: [],
      summary: 'Penny is working on the receipt.',
      title: 'Dinner receipt',
    })).toEqual({
      billItems: [],
      chatId: 'chat-1',
      people: ['Jojo', 'Sarah'],
      split: [],
      summary: 'Penny is working on the receipt.',
      title: 'Dinner receipt',
    })
  })

  it('drops null raw receipts but keeps non-null ones', () => {
    expect(normalizeSavedRunPayload({
      chatId: 'chat-1',
      rawReceipt: null,
      receipt: {
        totalCents: 1200,
      },
      title: 'Dinner receipt',
    })).toEqual({
      billItems: [],
      chatId: 'chat-1',
      receipt: {
        totalCents: 1200,
      },
      title: 'Dinner receipt',
    })

    expect(normalizeSavedRunPayload({
      chatId: 'chat-1',
      rawReceipt: {
        totalCents: 1300,
      },
      receipt: {
        totalCents: 1200,
      },
      title: 'Dinner receipt',
    })).toEqual({
      billItems: [],
      chatId: 'chat-1',
      rawReceipt: {
        totalCents: 1300,
      },
      receipt: {
        totalCents: 1200,
      },
      title: 'Dinner receipt',
    })
  })
})

describe('withRunMetadata', () => {
  it('returns schema-safe analysis results for persisted pending chats', () => {
    const result = withRunMetadata({
      created_at: '2026-04-18T12:14:32.000Z',
      id: 'run-1',
      payload: {
        billDate: '',
        chatId: 'chat-1',
        currency: 'EUR',
        history: [],
        items: [],
        merchant: 'Dinner receipt',
        notes: [],
        openai: {
          model: null,
          used: false,
        },
        people: ['Jojo', 'Sarah'],
        pi: {
          model: null,
          used: false,
        },
        receipt: null,
        source: 'pi-agent-pending',
        split: [],
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
  })
})
