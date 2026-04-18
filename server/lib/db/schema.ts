export async function createSchema(sql: any) {
  await sql`
    create table if not exists bill_runs (
      id text primary key,
      title text not null,
      payload jsonb not null,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create table if not exists people (
      id text primary key,
      name text not null,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create table if not exists groups (
      id text primary key,
      name text not null,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create table if not exists group_memberships (
      id text primary key,
      group_id text not null references groups(id) on delete cascade,
      person_id text not null references people(id) on delete cascade,
      created_at timestamptz not null default now(),
      unique (group_id, person_id)
    )
  `

  await sql`
    create table if not exists bills (
      id text primary key,
      group_id text not null references groups(id) on delete cascade,
      title text not null,
      total_amount_cents integer not null,
      tip_amount_cents integer not null default 0,
      paid_by_person_id text not null references people(id),
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create table if not exists bill_member_shares (
      id text primary key,
      bill_id text not null references bills(id) on delete cascade,
      person_id text not null references people(id),
      item_amount_cents integer not null,
      tip_amount_cents integer not null,
      total_amount_cents integer not null
    )
  `

  await sql`
    create table if not exists bill_items (
      id text primary key,
      bill_id text not null references bills(id) on delete cascade,
      name text not null,
      amount_cents integer not null,
      sort_order integer not null
    )
  `

  await sql`
    create table if not exists bill_item_assignments (
      id text primary key,
      bill_item_id text not null references bill_items(id) on delete cascade,
      person_id text not null references people(id),
      unique (bill_item_id, person_id)
    )
  `

  await sql`
    create table if not exists bill_transfers (
      id text primary key,
      bill_id text not null references bills(id) on delete cascade,
      group_id text references groups(id) on delete cascade,
      from_person_id text not null references people(id),
      to_person_id text not null references people(id),
      amount_cents integer not null
    )
  `

  await sql`
    alter table bill_transfers
    add column if not exists group_id text references groups(id) on delete cascade
  `

  await sql`
    update bill_transfers
    set group_id = bills.group_id
    from bills
    where bill_transfers.bill_id = bills.id
      and bill_transfers.group_id is null
  `

  await sql`
    alter table bill_transfers
    alter column group_id set not null
  `

  await sql`
    create index if not exists bill_transfers_group_id_idx
    on bill_transfers (group_id)
  `

  await sql`
    create table if not exists settlement_payments (
      id text primary key,
      group_id text not null references groups(id) on delete cascade,
      from_person_id text not null references people(id),
      to_person_id text not null references people(id),
      amount_cents integer not null,
      created_at timestamptz not null default now(),
      voided_at timestamptz
    )
  `

  await sql`
    create index if not exists settlement_payments_group_id_idx
    on settlement_payments (group_id, created_at desc)
  `
}
