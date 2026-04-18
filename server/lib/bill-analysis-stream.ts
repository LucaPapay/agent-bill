import { attachToAnalysisJob, startAnalysisJob } from './analysis-jobs'
import { runBillAnalysisPipeline, runBillRevisionPipeline } from './bill-pipeline'

export async function* streamBillAnalysis(input: any, personId: string) {
  yield* startAnalysisJob((push) => runBillAnalysisPipeline(input, personId, push))
}

export async function* streamBillRevision(input: any, personId: string) {
  yield* startAnalysisJob((push) => runBillRevisionPipeline(input, personId, push))
}

export async function* streamExistingBillChat(chatId: string) {
  const subscription = attachToAnalysisJob(chatId)

  if (!subscription) {
    return
  }

  yield* subscription
}
