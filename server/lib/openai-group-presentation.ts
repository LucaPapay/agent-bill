import OpenAI from 'openai'
import { z } from 'zod'
import {
  pickSuggestedGroupBackgroundColor,
} from '../../shared/group-icons'

let client: OpenAI | null = null

const groupPresentationSchema = z.object({
  icon: z.string().trim().min(1).max(16),
})

const groupPresentationFormat = {
  type: 'json_schema',
  name: 'group_presentation',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      icon: {
        type: 'string',
        minLength: 1,
        maxLength: 16,
      },
    },
    required: ['icon'],
    additionalProperties: false,
  },
} as const

function openai() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  return client
}

function buildPrompt(name: string) {
  return [
    'Pick a friendly group icon for a bill-splitting app.',
    `Group name: "${name}"`,
    'Return icon as a single emoji, not words.',
    'Pick the emoji that best matches the purpose or vibe of the group name.',
    'Return only the structured result.',
  ].join('\n')
}

async function requestGroupPresentation(name: string) {
  const response = await openai().responses.create({
    model: process.env.OPENAI_GROUP_PRESENTATION_MODEL || process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
    input: [{
      role: 'user',
      content: [{
        type: 'input_text',
        text: buildPrompt(name),
      }],
    }],
    text: {
      format: groupPresentationFormat,
    },
  })

  const outputText = response.output_text?.trim()

  if (!outputText) {
    throw new Error('OpenAI did not return a group presentation payload.')
  }

  const parsed = groupPresentationSchema.parse(JSON.parse(outputText))

  return {
    backgroundColor: pickSuggestedGroupBackgroundColor(name, parsed.icon),
    icon: parsed.icon,
  }
}

export async function generateGroupPresentation(name: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for group presentation generation.')
  }

  return await requestGroupPresentation(name)
}
