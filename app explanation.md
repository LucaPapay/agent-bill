# App Explanation

## What the app is

`agent-bill` is a local-first hackathon app for splitting bills with an agentic backend.

There are now two parallel tracks in the codebase:

- a manual ledger track for people, groups, bills, shares, and transfers
- a streamed receipt-analysis track that sends a receipt to OpenAI, then hands the structured result to a Pi agent loop

The manual ledger track is the stable storage base.
The streamed analysis track is the fast hackathon workflow.

## Current backend flow

The analysis backend is intentionally simple:

1. The frontend creates a job with `POST /api/analysis/jobs`.
2. The backend opens an in-memory job and starts emitting progress events.
3. OpenAI receives either:
   - a receipt image
   - or pasted OCR text
4. OpenAI returns a structured receipt JSON payload.
5. The backend normalizes that receipt into a predictable shape.
6. A Pi agent session receives the normalized receipt plus the participant list.
7. The Pi agent uses two custom tools:
   - `log_progress`
   - `submit_split_plan`
8. The backend persists the final run in Postgres.
9. The frontend listens on `GET /api/analysis/jobs/:id/events` through SSE until the job completes.

This is the current live path for bill analysis.

## Why SSE

We only need one-way server updates during analysis.
SSE is simpler than WebSockets here:

- no extra socket server setup
- works cleanly in Nitro
- easy to consume from `EventSource` in the browser
- matches the “start a job, stream status, finish once” model

So the app uses SSE for the active frontend connection.

## Current streamed event model

The SSE endpoint emits `update` events with JSON payloads.

Current payload types include:

- `status`
- `receipt_extracted`
- `agent_tool_start`
- `agent_tool_end`
- `agent_progress`
- `agent_text_delta`
- `agent_plan_submitted`
- `complete`
- `error`

That gives the frontend enough signal to show:

- pipeline stage
- extracted receipt preview
- live agent narration
- final split result
- failure state

## OpenAI step

The OpenAI stage lives in [server/lib/openai-receipt.ts](/Users/jojo/Developer/agent-bill/server/lib/openai-receipt.ts).

It uses the Responses API with structured output.
The prompt asks OpenAI to extract:

- merchant
- bill date
- currency
- items
- subtotal
- tax
- tip
- total
- short notes

Money is normalized to integer cents.

The schema lives in [server/lib/receipt-contract.ts](/Users/jojo/Developer/agent-bill/server/lib/receipt-contract.ts).

## Pi agent step

The Pi stage lives in [server/lib/pi-bill-agent.ts](/Users/jojo/Developer/agent-bill/server/lib/pi-bill-agent.ts).

It does not try to make the agent too smart.
The current rules are deliberately narrow:

- only use the provided participant names
- prefer shared splits when ownership is unclear
- distribute tax and tip proportionally
- call `log_progress` for short UI-visible updates
- call `submit_split_plan` exactly once

This keeps the loop hackathon-simple while still giving a real agent step instead of a single direct completion.

## Pipeline orchestration

The orchestration lives in [server/lib/bill-pipeline.ts](/Users/jojo/Developer/agent-bill/server/lib/bill-pipeline.ts).

Behavior today:

- if `OPENAI_API_KEY` exists:
  - use OpenAI extraction
  - then run the Pi agent loop
- if `OPENAI_API_KEY` is missing and only raw text is provided:
  - use the local fallback parser
- if an image is provided without `OPENAI_API_KEY`:
  - fail early

That keeps local development usable while still supporting the real AI path.

## Current frontend hook

The frontend stream consumer lives in [app/composables/useBillAnalysisStream.ts](/Users/jojo/Developer/agent-bill/app/composables/useBillAnalysisStream.ts).

It is responsible for:

- creating the analysis job
- opening the SSE stream
- collecting live feed messages
- accumulating agent text deltas
- storing the extracted receipt
- storing the final result

So the backend streaming contract already exists, even if the final screen integration is still lightweight.

## Current frontend UI shape

The current frontend UI is now a Vue screen flow instead of a prototype-style phone mock.

The main entry lives in [app/pages/index.vue](/Users/jojo/Developer/agent-bill/app/pages/index.vue).
It switches between the app screens with simple local state:

- home
- groups
- profile
- scan
- chat split
- assign
- settled

Shared UI primitives live in [app/components/app](/Users/jojo/Developer/agent-bill/app/components/app).
The actual screens live in [app/components/screens](/Users/jojo/Developer/agent-bill/app/components/screens).

The navigation is intentionally simple:

- on mobile it behaves like a bottom app dock
- on larger screens it becomes a sticky top app navigation bar

So the same app remains usable on phone and desktop without pretending to be inside a device frame.

## Responsive layout direction

The responsive styling lives in [app/assets/css/main.css](/Users/jojo/Developer/agent-bill/app/assets/css/main.css).

The current layout approach is:

- mobile keeps the tighter single-column flow
- tablet and desktop widen the app container
- larger screens use real content grids instead of scaling up a narrow phone view

Examples:

- the home screen opens into a two-column hero and activity layout
- the groups screen becomes a grid of group cards
- the profile screen separates identity and assistant/settings content
- the assign screen uses a main work area plus a sticky desktop summary sidebar

That keeps the visual language from the design reference, but makes it behave like an actual responsive app.

## Manual ledger data model

The Postgres schema currently contains:

- `bill_runs`
- `people`
- `groups`
- `group_memberships`
- `bills`
- `bill_member_shares`
- `bill_transfers`

The streamed analysis path currently persists into `bill_runs`.
The manual ledger path persists into the group and bill tables.

This split is fine for now because we are still figuring out the product shape.

## Current limitations

- jobs are in memory, so a server restart loses active streams
- there is no auth
- there is no OCR-only offline image path yet
- the Pi split logic is still conservative and defaults to shared allocation often
- migrations are still bootstrap SQL, not a formal migration tool

These are acceptable tradeoffs for the current hackathon phase.

## Next good steps

The next sensible backend steps are:

1. Convert streamed analysis output into real group bills and member shares.
2. Add a small review/edit step before saving the final split.
3. Make receipt ownership reasoning a second explicit agent pass instead of one combined pass.
4. Replace ad-hoc schema bootstrap with real migrations once the tables settle.
