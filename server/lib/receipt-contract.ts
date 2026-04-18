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

export const analysisInputSchema = z.object({
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
  people: z.array(z.string().trim().min(1)).min(1),
  rawText: z.string().trim().optional(),
  title: z.string().trim().min(1).default('Untitled bill'),
})

export const splitEntrySchema = z.object({
  amountCents: z.number().int().nonnegative(),
  note: z.string(),
  person: z.string(),
})

export const splitPlanSchema = z.object({
  notes: z.array(z.string()),
  split: z.array(splitEntrySchema),
  summary: z.string(),
})

const analysisEngineSchema = z.object({
  model: z.string().nullable(),
  used: z.boolean(),
})

export const analysisResultSchema = z.object({
  billDate: z.string(),
  currency: z.string(),
  items: extractedReceiptSchema.shape.items,
  merchant: z.string(),
  notes: z.array(z.string()),
  openai: analysisEngineSchema,
  pi: analysisEngineSchema,
  receipt: extractedReceiptSchema.optional(),
  runId: z.string(),
  savedAt: z.union([z.string(), z.date()]),
  source: z.string(),
  split: z.array(splitEntrySchema),
  summary: z.string(),
  taxCents: z.number().int().nonnegative(),
  tipCents: z.number().int().nonnegative(),
  title: z.string(),
  totalCents: z.number().int().nonnegative(),
})

export const analysisEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('status'),
    phase: z.enum(['queued', 'extracting', 'agent']),
    message: z.string(),
  }),
  z.object({
    type: z.literal('receipt_extracted'),
    model: z.string(),
    receipt: extractedReceiptSchema,
  }),
  z.object({
    type: z.literal('agent_progress'),
    message: z.string(),
    stage: z.string().optional(),
  }),
  z.object({
    type: z.literal('agent_text_delta'),
    delta: z.string(),
  }),
  z.object({
    type: z.literal('agent_tool_start'),
    toolName: z.string(),
  }),
  z.object({
    type: z.literal('agent_tool_end'),
    isError: z.boolean(),
    toolName: z.string(),
  }),
  z.object({
    type: z.literal('agent_plan_submitted'),
    plan: splitPlanSchema,
  }),
  z.object({
    type: z.literal('complete'),
    result: analysisResultSchema,
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
])
