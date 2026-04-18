# App Explanation

## What the app is

`agent-bill` is a local-first hackathon app for scanning bills, saving shared costs, and simplifying who owes whom inside a group.

There are two active tracks in the codebase:

- a receipt-analysis track that can use Pi/OpenAI or a local fallback parser
- a manual ledger track for fake-login users, groups, members, itemized bills, bill shares, raw transfers, and simplified group settlement

The manual ledger track is still the stable storage base. The newer frontend design now wraps that functionality in a more app-like route-based shell.

## Core product assumptions

- A local session picks one current user from saved people.
- The current user is not real auth yet; it is a local selected person persisted in the client.
- A person can belong to many groups.
- A group can contain many people.
- A group can contain many bills.
- A bill belongs to exactly one group.
- A bill has one payer.
- A bill stores the total amount and the tip amount separately.
- A bill can store explicit receipt items, but items are optional.
- Each bill item can be assigned to one or more group members.
- Tip is entered once per bill, then split automatically across bill participants.
- Bill detail should preserve the raw breakdown per person:
  - item amount
  - shared tip amount
  - total amount for that bill
- We persist both raw bill transfers and simplified group-level transfers derived from them.

## Current flow

1. If no current user is selected, the app redirects to `/login`.
2. The user picks an existing person as a fake login, or creates a new person there first.
3. The selected user is stored locally in the browser.
4. The app only loads groups that current user belongs to.
5. The user creates groups, adds existing people, and creates bills inside those visible groups.
6. The app stores saved bill items, bill member shares, and bill transfers in Postgres.
7. The selected group also exposes a simplified settlement view derived from all transfers in that group.

Separately:

1. The Scan screen now expects a real receipt image.
2. On mobile it opens the camera, and elsewhere it opens a file picker.
3. As soon as the user selects an image, the frontend opens a typed `oRPC` analysis stream in the same chat surface.
4. Penny now owns the full first pass: the Pi agent calls a receipt-parsing tool, receives the structured receipt, then submits the split plan in the same run.
5. After Penny proposes a split, the same chat now accepts follow-up user messages and runs a second typed `oRPC` revision stream against the parsed receipt plus the current split.
6. The split card can hand the proposed shares into the normal bill composer when the selected group contains matching people.
7. Every successful analysis run is saved as a `bill_runs` record.
8. The backend still supports raw text input for local fallback work, but that path is no longer exposed in the main scan UI.

## Current bill behavior

When creating a bill:

- the UI renders editable receipt items
- each item can be assigned to one or more people in the selected group
- the user can also leave the item list blank and fall back to an even split
- the UI renders one bill-level tip amount
- the user chooses who paid

When saving a bill:

- each item amount is split evenly across its assigned people
- if there are no saved items, the bill subtotal is split evenly across the full group
- the sum of all item amounts plus the tip must equal the bill total
- tip is split evenly across members who have a positive item share
- if nobody has a positive item share, tip falls back to being split evenly across all group members
- one per-person bill share row is stored for every group member
- one derived transfer is stored for every non-payer who owes a positive total on that bill
- every derived transfer also belongs to the group, not just the bill

Example:

- Alice paid
- item 1 assigned to Bob: 300
- item 2 assigned to Cara: 300
- item 3 assigned to Alice: 300
- tip: 100
- total: 1000

Then the bill shares preserve the raw breakdown per person, and the derived transfers say how much Bob and Cara owe Alice for that bill.

## Why payer is required

Without a payer, the app can show shares but it cannot create actual obligations.

The later simplification step needs obligations, not just percentages. So every bill needs a `paid_by_person_id`.

## Current data model

### `people`

Global people records reused across groups and used as the current fake-login identity.

- `id`
- `name`
- `created_at`

### `groups`

Manual user-created groups.

- `id`
- `name`
- `created_at`

### `group_memberships`

Join table between people and groups.

- `id`
- `group_id`
- `person_id`
- `created_at`

Constraint:

- unique `(group_id, person_id)`

### `bills`

One saved bill in one group.

- `id`
- `group_id`
- `title`
- `total_amount_cents`
- `tip_amount_cents`
- `paid_by_person_id`
- `created_at`

### `bill_member_shares`

The raw per-person bill breakdown that stays visible when opening a bill.

- `id`
- `bill_id`
- `person_id`
- `item_amount_cents`
- `tip_amount_cents`
- `total_amount_cents`

### `bill_items`

The saved receipt items for one bill.

- `id`
- `bill_id`
- `name`
- `amount_cents`
- `sort_order`

### `bill_item_assignments`

Join table between bill items and people.

- `id`
- `bill_item_id`
- `person_id`

### `bill_transfers`

The derived obligations created from one bill.

- `id`
- `bill_id`
- `group_id`
- `from_person_id`
- `to_person_id`
- `amount_cents`

This is the table the group-level simplification aggregates.

### `bill_runs`

Saved receipt-analysis runs.

- `id`
- `person_id`
- `title`
- `payload`
- `created_at`

## Current frontend behavior

The app now uses real Nuxt pages with a shared route shell and shared client ledger state.

The stable routes are:

- `/login` for choosing the current local user
- `/` for the home view
- `/groups` for creating people and groups and browsing all groups
- `/groups/:groupId` for one group, its members, settlement, and saved bills
- `/groups/:groupId/bills/new` for the itemized bill composer
- `/groups/:groupId/bills/:billId` for one saved bill and its derived transfers
- `/scan` for the unified scan and split chat flow
- `/chat-split` as a compatibility redirect back to `/scan`
- `/profile` for local app/profile status

The route shell keeps navigation and client-side ledger loading alive even on direct deep links.

There is also a global auth-style guard for the fake login flow:

- when no current user is stored, any app route redirects to `/login`
- when a current user exists, opening `/login` redirects back to `/`
- the current user can be cleared from the profile screen to switch users

The real manual-ledger functionality is now connected into the route structure like this:

- `Login` picks the current local user on `/login`
- `Groups` list and creation happen on `/groups`
- group detail and settlement happen on `/groups/:groupId`
- bill creation happens on `/groups/:groupId/bills/new`
- saved bill detail happens on `/groups/:groupId/bills/:billId`

The scan-first design flow is still only partially connected today:

- `Scan` now runs the real backend receipt pipeline through `oRPC` streaming in a single chat surface
- receipt parsing happens inside the Pi agent via a tool call instead of a separate pre-pass
- after the first split, the same chat can send revision messages back to Penny without leaving `/scan`
- the scan result can prefill the normal bill composer when the selected group has matching members
- the scan result does not yet save a final ledger bill automatically from the chat surface
- the durable manual workflow now runs through `/groups` -> `/groups/:groupId` -> `/groups/:groupId/bills/new` -> `/groups/:groupId/bills/:billId`

## Current frontend structure

The route split also changed how the frontend code is organized:

- `app/pages/` now owns the route-level files
- `app/components/layout/PageShell.vue` owns the shared app shell
- `app/composables/useLedgerState.ts` owns shared client ledger state, current-user selection state, and ledger mutations
- extracted ledger UI lives in `app/components/ledger/`

This keeps route files thin and makes direct routes like a single group or single bill work without rebuilding the old one-page screen machine.

For local demos:

- `npm run db:seed-demo` resets the manual-ledger tables
- it inserts 3 groups, 10 people, and 20 saved bills with deterministic fun sample data
- `npm run demo` clears all persisted app data, reseeds the demo set, and starts the dev app

## Group settlement behavior

The selected group exposes a simplified settlement view:

- collect all `bill_transfers` inside a group
- convert them into one net balance per person
- settle debtors against creditors directly
- reduce intermediate hops
- minimize the number of remaining payments

Target example:

- if A owes B
- and B owes C
- then the app should prefer reducing that into A owing C when the net amounts allow it

That simplification exists in the backend and is rendered in the group detail and settled views.

## Current user scoping rules

- `getLedger` now takes the current user id and only returns groups where that person is a member
- group creation automatically adds the current user as a member
- add-person, create-bill, update-bill, delete-bill, record-payment, and undo-payment all require current-user membership in that group
- people are still global so existing saved people can be added to a visible group
- this is intentionally a fake login layer for now, not real authentication

## Current automated coverage

The repo now has a small backend-focused unit suite run with `npm test`.

It currently checks the highest-risk pure logic pieces:

- settlement simplification in `server/lib/group-simplification.ts`
- bill share and transfer construction in `server/lib/group-ledger.ts`
- local fallback analysis and receipt normalization in `server/lib/bill-analysis.ts`

That coverage is deliberately narrow for now:

- it protects the money math and normalization rules that are easiest to regress
- it does not yet include full database integration tests or end-to-end UI tests
- it gives fast feedback on the core local-first ledger and analysis calculations

## Next intended step

Useful next work after this:

- connect receipt-analysis output into saved itemized bills
- add image OCR fallback for no-key local mode
- replace choose-a-user with real auth/session handling
- add household/session concepts once real auth exists
