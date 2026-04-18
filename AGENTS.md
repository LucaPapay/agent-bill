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

## App Shape

1. The UI lives in `app/`.
2. The local API lives in `server/`.
3. Bill analysis enters through oRPC at `/rpc`.
4. Every successful analysis run gets stored in Postgres.

## Current Flow

1. User uploads a receipt image or pastes bill text.
2. If `OPENAI_API_KEY` exists, Pi analyzes the bill and proposes a split.
3. If not, the app falls back to a local text parser and even split.
4. The normalized result is saved to Postgres as a bill run.

## Next Good Steps

- Add real OCR fallback for image-only mode without Pi.
- Add household/session concepts before adding auth.
- Add bill item ownership editing after the first automatic split.
