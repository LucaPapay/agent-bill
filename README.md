# agent-bill

`agent-bill` is a local-first hackathon app for shared costs.

It currently has two tracks:

- a manual ledger for groups, members, itemized bills, raw transfers, and simplified settlement
- a receipt-analysis path that can use OpenAI/Pi when `OPENAI_API_KEY` is present

The manual ledger is the real saved workflow today. The newer app shell wraps that workflow in a more polished multi-screen UI.

## What the app does

Today the app can:

- create people and groups locally
- add existing people into a selected group
- create saved bills with item-level assignments
- store per-person bill shares and derived transfers in Postgres
- show a simplified group settlement view across all bills in a group
- run receipt analysis and save successful analysis runs into `bill_runs`

The current UI shell has these screens:

- `Home`
- `Groups`
- `Profile`
- `Scan`
- `Chat Split`
- `Assign`
- `Settled`

Right now, `Groups`, `Assign`, and `Settled` are the screens wired to the saved manual ledger flow. `Scan` and `Chat Split` are still demo/presentation flow and are not yet connected back into saved bills.

## Stack

- Nuxt 4 with `ssr: false`
- Nitro server routes for the local backend
- oRPC mounted at `/rpc`
- Tailwind CSS v4 via `@tailwindcss/vite`
- Local Postgres in Docker Compose
- `@mariozechner/pi-ai` for bill analysis

## Local development

1. Install dependencies.
2. Copy `.env.example` to `.env`.
3. Add `OPENAI_API_KEY` if you want image-based receipt analysis.
4. Start the app:

```bash
npm run dev
```

That starts the Postgres container and then starts Nuxt dev mode.

## Demo mode

If you want a clean local demo with seeded data, run:

```bash
npm run demo
```

That command:

- starts Postgres
- clears all persisted app data
- seeds 3 groups, 10 people, and 20 fun demo bills
- starts the app in dev mode

If you only want to reset and seed the data without starting the app, run:

```bash
npm run db:seed-demo
```

## Receipt analysis behavior

- With `OPENAI_API_KEY`:
  - you can upload a receipt image or provide bill text
  - the app runs the OpenAI/Pi analysis path
- Without `OPENAI_API_KEY`:
  - pasted text can still go through the local fallback parser
  - image-only analysis is not available yet

Every successful analysis run is saved into the local `bill_runs` table.

## Current constraints

- no auth
- local-only workflow
- no payment settlement state yet
- receipt-analysis output is not yet connected into saved manual-ledger bills

## Project notes

The project-specific implementation notes live in [app explanation.md](./app%20explanation.md).
