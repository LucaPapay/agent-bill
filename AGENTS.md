# AGENTS.md

## Project

`agent-bill` is a local-first hackathon app for scanning bills, saving shared costs, and simplifying who owes whom inside a group.

See [app explanation.md](</Users/jojo/Developer/agent-bill/app explanation.md>) for the current product context.

## Current Stack

- Nuxt 4 with `ssr: false`
- `nuxt-auth-utils` for session handling and Google OAuth
- Nitro server routes for the local backend
- oRPC mounted at `/rpc`
- Tailwind CSS v4 via the Vite plugin
- Local Postgres in Docker Compose
- OpenAI + Penny-based receipt analysis

## Working Rules

- Keep the code stupid simple.
- Avoid type-heavy abstractions.
- Avoid `try/catch` unless there is a very good reason.
- Prefer one obvious happy path over framework cleverness.
- Keep everything local-first where possible.
- Auth already exists. Reuse the current session model instead of inventing another one.
- Other agents may be working in parallel; ignore unrelated changes you did not make.
- Work in a way that does not interrupt or overwrite another agent's in-flight changes.
- Do not change branches without asking; the user manages branches.
- Do not force-push, rebase published work, or rewrite history; only add new commits on top and push normally.

## App Shape

1. The UI lives in `app/`.
2. The local API lives in `server/`.
3. Bill analysis enters through oRPC at `/rpc`.
4. Manual-ledger data and bill chats are scoped by the authenticated `personId` from the current session.
5. Every successful analysis run gets stored in Postgres.

## Auth Model

- `/login` is the Google sign-in entrypoint.
- `app/middleware/auth.global.ts` protects the app routes.
- `server/routes/auth/google.get.ts` creates or updates the matching `people` row and stores `personId` in the session.
- Protected oRPC handlers read the current `personId` from `getUserSession(event)`.

## Backend Layout

- `server/orpc/router.ts` is the top-level oRPC router assembly.
- `server/orpc/routes/analysis.ts` owns receipt-analysis RPC procedures.
- `server/orpc/routes/ledger.ts` owns manual-ledger RPC procedures.
- `server/orpc/routes/health.ts` owns the health/status RPC procedure.
- `server/lib/ledger/service.ts` coordinates manual-ledger actions and access checks.
- `server/lib/group-ledger.ts` owns bill share and transfer math.
- `server/lib/db/client.ts` owns the shared Postgres client and schema bootstrap.
- `server/lib/db/schema.ts` owns the table and index creation SQL.
- `server/lib/db/groups.ts` owns people, groups, memberships, and Google-person lookup.
- `server/lib/db/bills.ts` owns bill create/update/delete persistence.
- `server/lib/db/settlements.ts` owns settlement payment persistence and validation.
- `server/lib/db/ledger-snapshot.ts` builds the client-facing ledger snapshot.
- `server/lib/openai-receipt.ts` owns receipt extraction.
- `server/lib/penny-agent/chat.ts` owns Penny chat persistence and saved run state.
- `server/lib/penny-agent/session.ts` owns the Pi session runner and Penny tool loop.
- `server/lib/penny-agent/stream.ts` owns streamed Penny chat turns.

## Backend Request Flow

1. A frontend action calls an oRPC procedure under `server/orpc/routes/`.
2. Protected routes read the authenticated `personId` from the request context.
3. Route handlers validate input and hand off to a small backend service or pipeline.
4. Manual-ledger writes go through `server/lib/ledger/service.ts`, which runs ledger math and then calls the DB layer.
5. Group, bill, and settlement mutations require session-user membership in that group.
6. Receipt analysis goes through `server/lib/penny-agent/chat.ts`, which saves chat state, runs Penny, and persists successful runs.

## Current Product Flow

1. The user signs in with Google on `/login`.
2. The app loads only groups the session user belongs to.
3. `/groups` and `/groups/:groupId` are the durable manual-ledger flow.
4. `/groups/:groupId/bills/new` and `/groups/:groupId/bills/:billId` handle bill creation and inspection.
5. `/scan` is the primary receipt-analysis surface and can prefill the bill composer.
6. The profile screen contains debug tools for creating a person and adding the current user to all groups.

## Tests

- Run `npm test` for the current backend/unit test suite.
- Run `npm run check` for the Nuxt typecheck.
- The automated coverage is still narrow and mostly protects pure money/analysis logic.
- DB-backed flows, auth flows, and most UI behavior are still verified manually through the app.
