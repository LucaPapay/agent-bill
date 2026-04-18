import { readBody } from 'h3'
import { z } from 'zod'
import { createAnalysisJob } from '../../../lib/analysis-jobs'

const inputSchema = z.object({
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
  people: z.array(z.string().trim().min(1)).min(1),
  rawText: z.string().trim().optional(),
  title: z.string().trim().optional(),
})

export default defineEventHandler(async (event) => {
  const body = inputSchema.parse(await readBody(event))
  return createAnalysisJob(body)
})
