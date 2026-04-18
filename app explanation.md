# App Explanation

## What the app is

`agent-bill` is a local-first hackathon app for scanning bills, saving shared costs, and simplifying who owes whom inside a group.

There are two active tracks in the codebase:

- a receipt-analysis track that can use Pi/OpenAI or a local fallback parser
- a manual ledger track for groups, members, itemized bills, bill shares, raw transfers, and simplified group settlement

The manual ledger track is still the stable storage base. The newer frontend design now wraps that functionality in a more app-like multi-screen flow.

## Core product assumptions

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

1. The user creates people and groups locally.
2. The user adds existing people into a selected group.
3. The user creates a bill for that group, either itemized or as an even split fallback.
4. The app stores saved bill items, bill member shares, and bill transfers in Postgres.
5. The selected group also exposes a simplified settlement view derived from all transfers in that group.

Separately:

1. The user can upload a receipt image or paste bill text.
2. If `OPENAI_API_KEY` exists, Pi analyzes the bill and proposes a split.
3. If not, the app falls back to a local text parser and even split.
4. Every successful analysis run is saved as a `bill_runs` record.

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

Global people records reused across groups.

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
- `title`
- `payload`
- `created_at`

## Current frontend behavior

The main page now uses a multi-screen shell:

- home
- groups
- profile
- scan
- chat split
- assign
- settled

The real manual-ledger functionality is connected into that shell through the Groups, Assign, and Settled screens:

- Groups is where the local ledger entities are managed
- Assign is where itemized bills are created and previewed
- Settled is where saved bill detail and simplified group settlement are reviewed

The scan-first design flow is only partially connected today:

- `Scan` and `Chat Split` are still presentation/demo flow
- they do not yet create saved ledger bills
- the durable manual workflow still runs through `Groups` -> `Assign` -> `Settled`

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

## Next intended step

Useful next work after this:

- connect receipt-analysis output into saved itemized bills
- add OCR fallback for image-only mode without Pi
- add household/session concepts before auth
- add payment settlement state once simplified group obligations are visible
