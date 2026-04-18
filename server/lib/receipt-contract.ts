import { z } from 'zod'

export const receiptExtractionFormat = {
  type: 'json_schema',
  name: 'receipt_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      billDate: { type: 'string' },
      currency: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            amountCents: { type: 'integer', minimum: 0 },
            name: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
          },
          required: ['amountCents', 'name', 'quantity'],
          additionalProperties: false,
        },
      },
      merchant: { type: 'string' },
      notes: {
        type: 'array',
        items: { type: 'string' },
      },
      subtotalCents: { type: 'integer', minimum: 0 },
      taxCents: { type: 'integer', minimum: 0 },
      tipCents: { type: 'integer', minimum: 0 },
      totalCents: { type: 'integer', minimum: 0 },
    },
    required: [
      'billDate',
      'currency',
      'items',
      'merchant',
      'notes',
      'subtotalCents',
      'taxCents',
      'tipCents',
      'totalCents',
    ],
    additionalProperties: false,
  },
} as const

export const extractedReceiptSchema = z.object({
  billDate: z.string(),
  currency: z.string(),
  items: z.array(z.object({
    amountCents: z.number().int().nonnegative(),
    name: z.string(),
    quantity: z.number().int().positive(),
  })),
  merchant: z.string(),
  notes: z.array(z.string()),
  subtotalCents: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative(),
  tipCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
})

export const splitPlanSchema = z.object({
  notes: z.array(z.string()),
  split: z.array(z.object({
    amountCents: z.number().int().nonnegative(),
    note: z.string(),
    person: z.string(),
  })),
  summary: z.string(),
})
