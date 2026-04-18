# <img src="./public/agent-bill-no-bg.png" alt="agent-bill logo" width="84" />

# agent-bill

Built for the **OpenAI Codex Community Hackathon**.

`agent-bill` is an app for the worst part of dinner with friends or colleagues: figuring out the bill without opening a spreadsheet or starting a tiny civil war in the group chat.

You scan a receipt, Penny helps split it, and the app keeps a proper little ledger underneath.

## What It Does

- scan a receipt
- turn it into a bill
- ask Penny to split it
- argue with Penny in chat until the split looks right
- save the result in a real group ledger
- show the cleanest version of who owes whom

## Why There Are Agents In It

Receipts are messy. Humans are also messy.

So Agent-Penny does the annoying part:

- reads the receipt
- makes a first guess at the split
- handles follow-ups like "the fries were for the table" or "I got the second round"

Then the ledger takes over and stores the boring truth.

## Current Shape

- google o-auth
- groups and members
- itemized bills
- tip splitting
- saved bill runs
- simplified settlement view

## Screens

| Home | Groups |
| --- | --- |
| ![Home screen](./design/home%20screenshot.png) | ![Groups screen](./design/groups%20screenshot.png) |

## Stack

- Nuxt 4 with `ssr: false`
- Nitro server routes for the local backend
- `oRPC` for typed client/server calls
- Tailwind CSS v4
- Postgres in Docker Compose
- `@mariozechner/pi-ai` for the agent flow

## Project Notes

The current product explanation and implementation notes live in [app explanation.md](./app%20explanation.md).

---

## Setup

### Requirements

- Node.js
- npm
- Docker with Docker Compose

### Local Dev

1. Install dependencies:

```bash
npm install
```

2. Copy the env file:

```bash
cp .env.example .env
```

3. Optional: add `OPENAI_API_KEY` to enable image-based receipt analysis.

4. Start the app:

```bash
npm run dev
```

That starts the Postgres container and then runs the Nuxt dev server.

## Demo Mode

For a clean demo with seeded data:

```bash
npm run demo
```

That will:

- start Postgres
- reset the manual-ledger data
- seed 3 groups, 10 people, and 20 demo bills
- launch the app in dev mode

If you only want to reseed the demo data:

```bash
npm run db:seed-demo
```

## Test

```bash
npm test
```

## Environment Notes

- `OPENAI_API_KEY` enables the receipt-analysis agent flow for real receipt images.
- Without it, the app still supports a local fallback parsing path.
- `DATABASE_URL` points at the local Postgres instance used by the app.
