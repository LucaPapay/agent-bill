import OpenAI, { toFile } from 'openai'

let client: null | OpenAI = null

function openai() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  return client
}

function getAudioFilename(mimeType: string) {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase()

  if (normalizedMimeType.includes('mp4') || normalizedMimeType.includes('m4a')) {
    return 'voice.m4a'
  }

  if (normalizedMimeType.includes('mpeg') || normalizedMimeType.includes('mp3')) {
    return 'voice.mp3'
  }

  if (normalizedMimeType.includes('ogg')) {
    return 'voice.ogg'
  }

  if (normalizedMimeType.includes('wav')) {
    return 'voice.wav'
  }

  return 'voice.webm'
}

function buildPrompt({
  groupName,
  groups,
  people,
}: {
  groupName?: string
  groups?: string[]
  people?: string[]
}) {
  const knownGroups = Array.isArray(groups) ? groups.filter(Boolean).slice(0, 20) : []
  const knownPeople = Array.isArray(people) ? people.filter(Boolean).slice(0, 20) : []
  const lines = [
    'Transcribe this short voice note for a bill-splitting chat.',
    'Keep punctuation and names when they are clear.',
    'Return only the spoken transcript.',
  ]

  if (groupName) {
    lines.push(`Current group: ${groupName}.`)
  }

  if (knownGroups.length) {
    lines.push(`Possible group names: ${knownGroups.join(', ')}.`)
  }

  if (knownPeople.length) {
    lines.push(`Possible person names: ${knownPeople.join(', ')}.`)
  }

  return lines.join('\n')
}

export async function transcribeVoiceNote({
  audioBase64,
  groupName,
  groups,
  mimeType,
  people,
}: {
  audioBase64: string
  groupName?: string
  groups?: string[]
  mimeType: string
  people?: string[]
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for voice transcription.')
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe'
  const file = await toFile(
    Buffer.from(audioBase64, 'base64'),
    getAudioFilename(mimeType),
    { type: mimeType },
  )

  const response = await openai().audio.transcriptions.create({
    file,
    model,
    prompt: buildPrompt({
      groupName,
      groups,
      people,
    }),
  })

  return {
    text: String(response.text || '').trim(),
  }
}
