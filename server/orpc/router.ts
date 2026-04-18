import { analysisRouter } from './routes/analysis'
import { healthRouter } from './routes/health'
import { ledgerRouter } from './routes/ledger'

export const router = {
  ...analysisRouter,
  ...healthRouter,
  ...ledgerRouter,
}

export type AppRouter = typeof router
