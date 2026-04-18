import {
  createAgentAnalysis,
  createLocalAnalysis,
  normalizeExtractedReceipt,
  normalizePeople,
} from './bill-analysis'
import { saveBillRun } from './db'
import { extractReceiptWithOpenAI } from './openai-receipt'
import { runPiBillAgent } from './pi-bill-agent'

export async function runBillAnalysisPipeline(input: any, onEvent = (_payload: any) => {}) {
  const title = String(input?.title || 'Untitled bill').trim() || 'Untitled bill'
  const people = normalizePeople(input?.people || [])

  if (!people.length) {
    throw new Error('At least one participant is required.')
  }

  if (!process.env.OPENAI_API_KEY) {
    if (input?.imageBase64) {
      throw new Error('OPENAI_API_KEY is required for image analysis.')
    }

    const fallback = createLocalAnalysis({
      imageProvided: false,
      notes: ['OPENAI_API_KEY is missing, so the backend used the local text parser.'],
      people,
      rawText: input?.rawText,
      title,
    })

    const run = await saveBillRun(fallback)

    return {
      ...fallback,
      runId: run.id,
      savedAt: run.createdAt,
    }
  }

  if (!input?.imageBase64 && !input?.rawText) {
    throw new Error('Provide a receipt image or OCR text.')
  }

  const extractedReceipt = normalizeExtractedReceipt(await extractReceiptWithOpenAI({
    imageBase64: input?.imageBase64,
    mimeType: input?.mimeType,
    onEvent,
    people,
    rawText: input?.rawText,
    title,
  }))

  const splitPlan = await runPiBillAgent({
    onEvent,
    people,
    receipt: extractedReceipt,
    title,
  })

  const analysis = createAgentAnalysis({
    imageProvided: Boolean(input?.imageBase64),
    people,
    plan: splitPlan,
    receipt: extractedReceipt,
    title,
  })

  const run = await saveBillRun(analysis)

  return {
    ...analysis,
    runId: run.id,
    savedAt: run.createdAt,
  }
}
