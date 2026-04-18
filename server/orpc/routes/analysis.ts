import { eventIterator, os } from '@orpc/server'
import { runBillAnalysisPipeline } from '../../lib/bill-pipeline'
import { streamBillAnalysis } from '../../lib/bill-analysis-stream'
import {
  analysisEventSchema,
  analysisInputSchema,
  analysisResultSchema,
} from '../../lib/receipt-contract'

export const analyzeBill = os
  .input(analysisInputSchema)
  .output(analysisResultSchema)
  .handler(async ({ input }) => runBillAnalysisPipeline(input))

export const analyzeBillStream = os
  .input(analysisInputSchema)
  .output(eventIterator(analysisEventSchema))
  .handler(async function* ({ input }) {
    yield* streamBillAnalysis(input)
  })

export const analysisRouter = {
  analyzeBill,
  analyzeBillStream,
}
