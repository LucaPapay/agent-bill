import { os } from '@orpc/server'
import { z } from 'zod'
import { createLocalAnalysis, normalizePeople, normalizePiAnalysis } from '../lib/bill-analysis'
import { saveBillRun } from '../lib/db'
import { analyzeBillWithPi } from '../lib/pi-analysis'

const analyzeBill = os
  .input(z.object({
    imageBase64: z.string().optional(),
    mimeType: z.string().optional(),
    people: z.array(z.string().trim().min(1)).min(1),
    rawText: z.string().trim().optional(),
    title: z.string().trim().min(1).default('Untitled bill'),
  }))
  .handler(async ({ input }) => {
    const people = normalizePeople(input.people)
    const notes: string[] = []
    const piAnalysis = await analyzeBillWithPi({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      people,
      rawText: input.rawText,
    })

    if (!piAnalysis && input.imageBase64 && !process.env.OPENAI_API_KEY) {
      notes.push('OPENAI_API_KEY is not set, so the app fell back to local parsing.')
    }

    const analysis = piAnalysis
      ? normalizePiAnalysis({
          imageProvided: Boolean(input.imageBase64),
          notes,
          people,
          piAnalysis,
          title: input.title,
        })
      : createLocalAnalysis({
          imageProvided: Boolean(input.imageBase64),
          notes,
          people,
          rawText: input.rawText,
          title: input.title,
        })

    const run = await saveBillRun(analysis)

    return {
      ...analysis,
      runId: run.id,
      savedAt: run.createdAt,
    }
  })

const health = os.handler(() => ({
  databaseConfigured: Boolean(useRuntimeConfig().databaseUrl),
  name: 'agent-bill',
  piReady: Boolean(process.env.OPENAI_API_KEY),
  timestamp: new Date().toISOString(),
}))

export const router = {
  analyzeBill,
  health,
}

export type AppRouter = typeof router
