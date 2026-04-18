import OpenAI from 'openai'
import { extractedReceiptSchema, receiptExtractionFormat } from './receipt-contract'

let client: OpenAI | null = null

function openai() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  return client
}

function buildPrompt({ title, people, rawText }: {
  title: string
  people: string[]
  rawText?: string
}) {
  const rawTextBlock = rawText
    ? `OCR fallback text:\n${rawText.slice(0, 8000)}`
    : ''

  return [
    `Extract a restaurant receipt for "${title}".`,
    'Return merchant, bill date, currency, items, subtotal, tax, tip, total, and short extraction notes.',
    'Rules:',
    '- Return billDate as YYYY-MM-DD when the receipt shows a date.',
    '- Use integer cents for every money field.',
    '- Convert decimal currency values to cents exactly once. Example: EUR 112.10 -> 11210.',
    '- Keep quantity as an integer.',
    '- amountCents for each item must be the full line total for that receipt row, not the unit price.',
    '- Do not multiply cents by 10 or 1000. Do not multiply a row total by quantity again.',
    '- If a field is missing, use an empty string or 0 instead of inventing a value.',
    '- subtotalCents + taxCents + tipCents should match totalCents when the receipt shows those values.',
    '- Keep notes short and concrete.',
    rawTextBlock,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export async function extractReceiptWithOpenAI({
  title,
  people,
  imageBase64,
  mimeType,
  rawText,
  onEvent = () => {},
}: {
  title: string
  people: string[]
  imageBase64?: string
  mimeType?: string
  rawText?: string
  onEvent?: (payload: any) => void
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for OpenAI receipt extraction.')
  }

  const content: any[] = [{
    type: 'input_text',
    text: buildPrompt({ title, people, rawText }),
  }]

  if (imageBase64) {
    content.push({
      type: 'input_image',
      image_url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
    })
  }

  const model = process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini'

  await onEvent({
    type: 'status',
    phase: 'extracting',
    message: 'Penny is shipping the receipt to OpenAI for structured extraction.',
  })

  const response = await openai().responses.create({
    model,
    input: [{
      role: 'user',
      content,
    }],
    text: {
      format: receiptExtractionFormat,
    },
  })

  const outputText = response.output_text?.trim()

  if (!outputText) {
    throw new Error('OpenAI did not return a structured receipt payload.')
  }

  const parsed = extractedReceiptSchema.parse(JSON.parse(outputText))

  await onEvent({
    type: 'receipt_extracted',
    model,
    receipt: parsed,
  })

  return parsed
}
