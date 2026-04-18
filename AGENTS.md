# AGENTS.md

## Project

`agent-bill` is a local-first hackathon app for scanning bills and splitting them with agents.

See [app explanation.md](</Users/lucapapay/dev/agent-bill/app explanation.md>) for the current product understanding, ledger model, and implementation notes.

## Current Stack

- Nuxt 4 with `ssr: false`
- Nitro server routes for the local backend
- oRPC for typed client/server calls
- Tailwind CSS v4 via the Vite plugin
- Postgres in Docker Compose
- `@mariozechner/pi-ai` for bill analysis

## Working Rules

- Keep the code stupid simple.
- Avoid type-heavy abstractions.
- Avoid `try/catch` unless there is a very good reason.
- Prefer one obvious happy path over framework cleverness.
- Keep everything local-first for now.
- Do not add auth yet.
- Other agents may be working in parallel; ignore unrelated changes you did not make.
- Work in a way that does not interrupt or overwrite another agent's in-flight changes.
- Do not change branches without asking; the user manages branches.
- Do not force-push, rebase published work, or rewrite history; only add new commits on top and push normally.

## App Shape

1. The UI lives in `app/`.
2. The local API lives in `server/`.
3. Bill analysis enters through oRPC at `/rpc`.
4. Every successful analysis run gets stored in Postgres.

## Backend Layout

- `server/orpc/router.ts` is now only the top-level oRPC router assembly.
- `server/orpc/routes/analysis.ts` owns analysis RPC procedures.
- `server/orpc/routes/ledger.ts` owns manual-ledger RPC procedures.
- `server/orpc/routes/health.ts` owns the health/status RPC procedure.
- `server/lib/ledger/service.ts` is the orchestration layer for manual-ledger actions:
  - it combines ledger math from `server/lib/group-ledger.ts`
  - with persistence from the database modules
- `server/lib/db.ts` is now just a thin export surface for the database layer.
- `server/lib/db/client.ts` owns the shared Postgres client and one-time schema bootstrap.
- `server/lib/db/schema.ts` owns the table/index creation SQL.
- `server/lib/db/bill-runs.ts` stores receipt-analysis runs.
- `server/lib/db/groups.ts` owns people, groups, and group membership queries/writes.
- `server/lib/db/bills.ts` owns bill create/update/delete persistence and the settlement lock check used before destructive bill edits.
- `server/lib/db/settlements.ts` owns settlement payment persistence and open-settlement validation.
- `server/lib/db/ledger-snapshot.ts` builds the full client-facing ledger snapshot shape from Postgres rows.
- Receipt-analysis backend flow still lives in:
  - `server/lib/bill-pipeline.ts` for the end-to-end analysis path
  - `server/lib/openai-receipt.ts` for OpenAI receipt extraction
  - `server/lib/pi-bill-agent.ts` for the Pi split agent loop
  - `server/lib/analysis-jobs.ts` for in-memory streamed analysis jobs and SSE fanout

## Backend Request Flow

1. A frontend action calls an oRPC procedure under `server/orpc/routes/`.
2. The route handler validates input and hands off to a small backend service or pipeline.
3. Manual-ledger writes go through `server/lib/ledger/service.ts`, which computes member shares/transfers first, then calls the database modules.
4. Database modules in `server/lib/db/` own persistence only:
  - schema/bootstrap
  - focused writes and reads by domain
  - rebuilding the full ledger snapshot returned to the UI
5. Receipt analysis goes through `server/lib/bill-pipeline.ts`:
  - local fallback when no `OPENAI_API_KEY`
  - OpenAI receipt extraction when a key exists
  - Pi agent split planning on top of the normalized receipt
6. Successful receipt analyses are stored as `bill_runs`.

## Backend Tests

- Run `npm test` for the current backend/unit test suite.
- The test suite is intentionally focused on pure logic modules that are easy to break and cheap to verify.
- Current coverage includes:
  - `server/lib/group-simplification.ts` for transfer netting and open-settlement calculation
  - `server/lib/group-ledger.ts` for bill share construction, tip distribution, and transfer generation
  - `server/lib/bill-analysis.ts` for people normalization, local fallback parsing, and receipt money normalization
- The DB modules are still exercised manually through the app flows rather than through a heavier integration harness.

## Current Flow

1. User uploads a receipt image or pastes bill text.
2. If `OPENAI_API_KEY` exists, Pi analyzes the bill and proposes a split.
3. If not, the app falls back to a local text parser and even split.
4. The normalized result is saved to Postgres as a bill run.

## Manual Ledger Status

- Groups own bills and the derived transfers.
- Manual bills are item-based now, not one flat share row per person.
- Each bill stores bill items, item assignees, member shares, and raw transfers.
- The selected group also exposes a simplified settlement view built from all transfers in that group.

## Frontend Shell Status

- The app now uses real Nuxt routes instead of a single screen-switching page.
- Shared client ledger state lives in a composable so direct route loads still work.
- The main durable manual-ledger routes are:
  - `/groups`
  - `/groups/:groupId`
  - `/groups/:groupId/bills/new`
  - `/groups/:groupId/bills/:billId`
- `Scan` and `Chat Split` still act as design/demo flow and are not yet connected back into saved itemized bills.

## Demo Seed

- Run `npm run db:seed-demo` to reset the manual-ledger tables and load 3 groups, 10 people, and 20 demo bills.
- The seed data is intentionally fun and deterministic so local demos always look the same.
- Run `npm run demo` to clear all persisted app data, reseed the demo data, and start the app.

## Next Good Steps

- Add real OCR fallback for image-only mode without Pi.
- Add household/session concepts before adding auth.
- Connect receipt-analysis output into the manual ledger item model.
- Add actual mark-as-paid / settlement tracking once group settlement is visible.
