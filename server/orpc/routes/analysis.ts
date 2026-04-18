import { os } from '@orpc/server'
import { z } from 'zod'
import { runBillAnalysisPipeline } from '../../lib/bill-pipeline'

export const analyzeBill = os
  .input(z.object({
    imageBase64: z.string().optional(),
    mimeType: z.string().optional(),
    people: z.array(z.string().trim().min(1)).min(1),
    rawText: z.string().trim().optional(),
    title: z.string().trim().min(1).default('Untitled bill'),
  }))
  .handler(async ({ input }) => runBillAnalysisPipeline(input))

export const analysisRouter = {
  analyzeBill,
}
