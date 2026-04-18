import { Type, complete, getModel } from '@mariozechner/pi-ai'

const model = getModel('openai', 'gpt-4o-mini')

const submitBillAnalysis = {
  description: 'Return the parsed receipt items and a fair split for the provided participants.',
  name: 'submit_bill_analysis',
  parameters: Type.Object({
    items: Type.Array(
      Type.Object({
        amountCents: Type.Integer({ minimum: 0 }),
        name: Type.String(),
      }),
    ),
    split: Type.Array(
      Type.Object({
        amountCents: Type.Integer({ minimum: 0 }),
        note: Type.Optional(Type.String()),
        person: Type.String(),
      }),
    ),
    summary: Type.String(),
    taxCents: Type.Optional(Type.Integer({ minimum: 0 })),
    tipCents: Type.Optional(Type.Integer({ minimum: 0 })),
    totalCents: Type.Integer({ minimum: 0 }),
  }),
}

function buildPrompt({ people, rawText }: { people: string[]; rawText?: string }) {
  const participants = people.map((person: string) => `- ${person}`).join('\n')
  const rawTextSection = rawText
    ? `\nReceipt text fallback:\n${String(rawText).slice(0, 6000)}`
    : ''

  return [
    'Analyze this receipt and propose a practical split.',
    'Rules:',
    '- Use only the provided participant names.',
    '- Return all money fields as integer cents.',
    '- If ownership is unclear, default to an even split across everyone.',
    '- Keep the summary short and concrete.',
    '',
    'Participants:',
    participants,
    rawTextSection,
  ].join('\n')
}

export async function analyzeBillWithPi({
  imageBase64,
  mimeType,
  people,
  rawText,
}: {
  imageBase64?: string
  mimeType?: string
  people: string[]
  rawText?: string
}) {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
  > = [{ type: 'text', text: buildPrompt({ people, rawText }) }]

  if (imageBase64) {
    content.push({
      data: imageBase64,
      mimeType: mimeType || 'image/jpeg',
      type: 'image',
    })
  }

  const response = await complete(model, {
    messages: [{ role: 'user', content, timestamp: Date.now() }],
    systemPrompt: 'You are a receipt parsing and bill splitting assistant. Always finish by calling the provided tool exactly once.',
    tools: [submitBillAnalysis],
  })

  return response.content.find(block => block.type === 'toolCall')?.arguments || null
}
