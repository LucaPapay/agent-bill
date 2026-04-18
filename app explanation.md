# App Explanation

## What the app is

`agent-bill` is a local-first hackathon app for bills, shared costs, and later debt simplification inside a group.

The app now has two tracks:

- an existing receipt-analysis track that can use Pi/OpenAI or a local fallback parser
- a manual ledger track for groups, members, bills, bill shares, and derived transfers

The manual ledger track is the important base for the next step, because simplification only makes sense once the app stores explicit who-owes-whom data.

## Core product assumptions

- A person can belong to many groups.
- A group can contain many people.
- A group can contain many bills.
- A bill belongs to exactly one group.
- A bill has one payer.
- A bill stores the total amount and the tip amount separately.
- A bill shows one manual food share row per group member.
- Tip is entered once per bill, then split automatically across bill participants.
- We still want bill detail to show the raw breakdown per person:
  - food amount
  - shared tip amount
  - total amount for that bill
- We also want to persist the derived transfers, because the later simplify step will work from them.

## Current bill behavior

When creating a bill:

- the UI renders one editable food split row per member in the selected group
- the UI renders one bill-level tip amount
- the user chooses who paid

When saving a bill:

- the sum of all food shares plus the tip must equal the bill total
- tip is split evenly across members who have a positive food share
- if nobody has a positive food share, tip falls back to being split evenly across all group members
- one per-person bill share row is stored for every group member
- one derived transfer is stored for every non-payer who owes a positive total on that bill

Example:

- Alice paid
- Bob food: 300
- Cara food: 300
- Alice food: 300
- tip: 100
- total: 1000

Then the bill shares preserve the raw breakdown per person, and the derived transfers say how much Bob and Cara owe Alice for that bill.

## Why payer is required

Without a payer, the app can show shares but it cannot create actual obligations.

The later simplification step needs obligations, not just bill percentages. So every bill needs a `paid_by_person_id`.

## Current data model

### `people`

Global people records. These are reused across groups.

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

### `bill_transfers`

The derived obligations created from one bill.

- `id`
- `bill_id`
- `from_person_id`
- `to_person_id`
- `amount_cents`

This is the table the future group-level simplification should aggregate.

## Current frontend behavior

The main page now acts as a simple manual ledger:

- create a person
- create a group
- add existing people into the selected group
- create a bill for that group
- inspect saved bills
- inspect both raw bill shares and derived transfers

## Next intended step

The next logical feature is group-level simplification:

- collect all `bill_transfers` inside a group
- net flows per person pair
- reduce intermediate hops
- minimize the number of people each person owes

Target example:

- if A owes B
- and B owes C
- then the app should prefer reducing that into A owing C when the net amounts allow it

The manual ledger work added here is meant to make that next step straightforward.
