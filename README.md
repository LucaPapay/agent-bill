# agent-bill

Local-first hackathon scaffold for scanning bills and splitting them with agents.

## What is in this setup

- Nuxt 4 with `ssr: false` for a pure SPA frontend
- Nitro server routes for local backend code
- oRPC mounted at `/rpc`
- Tailwind CSS v4 via `@tailwindcss/vite`
- Local Postgres in Docker Compose
- `@mariozechner/pi-ai` for receipt analysis when `OPENAI_API_KEY` is present

## Local development

1. Install dependencies.
2. Copy `.env.example` to `.env`.
3. Add `OPENAI_API_KEY` if you want image-based receipt analysis.
4. Run:

```bash
npm run dev
```

That command starts the Postgres container and then starts Nuxt dev mode.

## How the app behaves today

- With `OPENAI_API_KEY`:
  - you can upload a receipt image
  - Pi reads the receipt and proposes a split
- Without `OPENAI_API_KEY`:
  - paste OCR text into the textarea
  - the app parses simple line items locally
  - the split falls back to an even split

Every successful analysis run is saved into the local `bill_runs` table.

## Current constraints

- No auth
- Local only
- Minimal schema
- No production deployment shape yet

## Initial setup choices

- Postgres is intentionally simple: one container, one table, no ORM yet.
- Pi is intentionally narrow: one server-side bill analysis path, no long-lived agent sessions yet.
- The UI is a thin shell around one useful flow so the hackathon work can move into receipt quality and split logic next.
