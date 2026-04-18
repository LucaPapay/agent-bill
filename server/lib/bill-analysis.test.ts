import { describe, expect, it } from 'vitest'
import {
  createLocalAnalysis,
  editExtractedReceipt,
  normalizeExtractedReceipt,
  normalizePeople,
  reconcileExtractedReceipt,
} from './bill-analysis'
import { normalizeBillDate } from './bill-date'

describe('normalizePeople', () => {
  it('trims names, removes blanks, and deduplicates while keeping order', () => {
    expect(normalizePeople([' Alice ', '', 'Bob', 'Alice', '  Bob  ', 'Cara'])).toEqual([
      'Alice',
      'Bob',
      'Cara',
    ])
  })
})

describe('createLocalAnalysis', () => {
  it('parses receipt-like text and returns the extracted bill items', () => {
    expect(createLocalAnalysis({
      imageProvided: false,
      people: ['Alice', 'Bob'],
      rawText: [
        'Pasta 12.50',
        'Dessert 5.50',
        'Tax 1.20',
        'Tip 2.80',
        'Total 22.00',
      ].join('\n'),
      title: 'Dinner',
    })).toMatchObject({
      currency: 'EUR',
      merchant: 'Dinner',
      source: 'local-text',
      taxCents: 120,
      tipCents: 280,
      totalCents: 2200,
      split: [],
    })
  })

  it('adds helpful image-only fallback notes when no OCR text is available', () => {
    const analysis = createLocalAnalysis({
      imageProvided: true,
      people: ['Alice', 'Bob'],
      title: 'Receipt',
    })

    expect(analysis.notes).toContain('An image was uploaded, but no AI key was available, so image-only analysis was skipped.')
    expect(analysis.notes).toContain('Paste OCR text or add OPENAI_API_KEY if you want the app to read receipt images.')
    expect(analysis.source).toBe('local-empty')
  })

  it('pulls a visible receipt date out of OCR text', () => {
    expect(createLocalAnalysis({
      imageProvided: false,
      people: ['Alice', 'Bob'],
      rawText: [
        'Cafe Sample',
        '18/04/2026',
        'Pasta 12.50',
        'Total 12.50',
      ].join('\n'),
      title: 'Dinner',
    }).billDate).toBe('2026-04-18')
  })
})

describe('normalizeBillDate', () => {
  it('normalizes common receipt date formats into YYYY-MM-DD', () => {
    expect(normalizeBillDate('2026-04-18')).toBe('2026-04-18')
    expect(normalizeBillDate('18/04/2026')).toBe('2026-04-18')
    expect(normalizeBillDate('Apr 18, 2026')).toBe('2026-04-18')
  })
})

describe('normalizeExtractedReceipt', () => {
  it('rescales oversized OpenAI money fields to match item totals', () => {
    expect(normalizeExtractedReceipt({
      billDate: '2026-04-18',
      currency: 'USD',
      items: [
        { amount: '12.50', name: 'Pasta', quantity: 1 },
        { amount: '5.50', name: 'Dessert', quantity: 1 },
      ],
      merchant: 'Cafe',
      notes: ['raw extraction'],
      subtotalCents: 180000,
      taxCents: 12000,
      tipCents: 30000,
      totalCents: 222000,
    })).toEqual({
      billDate: '2026-04-18',
      currency: 'USD',
      items: [
        { amountCents: 1250, name: 'Pasta', quantity: 1 },
        { amountCents: 550, name: 'Dessert', quantity: 1 },
      ],
      merchant: 'Cafe',
      notes: [
        'raw extraction',
        'Normalized OpenAI money fields by 100x to match the item totals.',
      ],
      subtotalCents: 1800,
      taxCents: 120,
      tipCents: 300,
      totalCents: 2220,
    })
  })
})

describe('reconcileExtractedReceipt', () => {
  it('matches the subtotal to the item rows and repairs tax as the remainder', () => {
    const result = reconcileExtractedReceipt({
      billDate: '2026-04-18',
      currency: 'EUR',
      items: [
        { amountCents: 1250, name: 'Pasta', quantity: 1 },
        { amountCents: 550, name: 'Dessert', quantity: 1 },
      ],
      merchant: 'Cafe',
      subtotalCents: 1900,
      taxCents: 0,
      tipCents: 300,
      totalCents: 2220,
    })

    expect(result.summary).toBe('Reconciled 2 receipt fields so the math balances.')
    expect(result.corrections).toEqual([
      {
        field: 'subtotalCents',
        from: 1900,
        reason: 'Matched the subtotal to the extracted line items.',
        to: 1800,
      },
      {
        field: 'taxCents',
        from: 0,
        reason: 'Adjusted tax to reconcile the subtotal, tip, and total.',
        to: 120,
      },
    ])
    expect(result.receipt).toMatchObject({
      subtotalCents: 1800,
      taxCents: 120,
      tipCents: 300,
      totalCents: 2220,
    })
  })
})

describe('editExtractedReceipt', () => {
  it('applies explicit receipt corrections and keeps the receipt normalized', () => {
    const result = editExtractedReceipt({
      billDate: '2026-04-18',
      currency: 'EUR',
      items: [
        { amountCents: 1250, name: 'Pasta', quantity: 1 },
        { amountCents: 550, name: 'Dessert', quantity: 1 },
      ],
      merchant: 'Cafe',
      subtotalCents: 1800,
      taxCents: 120,
      tipCents: 300,
      totalCents: 2220,
    }, {
      tipCents: 0,
      totalCents: 1920,
    }, 'tip was not on the receipt')

    expect(result.summary).toBe('Updated 2 receipt fields and kept the receipt normalized.')
    expect(result.corrections).toEqual([
      {
        field: 'tipCents',
        from: 300,
        reason: 'Updated the receipt tip.',
        to: 0,
      },
      {
        field: 'totalCents',
        from: 2220,
        reason: 'Updated the receipt total.',
        to: 1920,
      },
    ])
    expect(result.receipt.notes).toContain('Penny updated the extracted receipt: tip was not on the receipt.')
    expect(result.receipt.totalCents).toBe(1920)
    expect(result.receipt.tipCents).toBe(0)
  })
})
