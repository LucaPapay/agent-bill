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
      email text,
      google_sub text,
      avatar_url text,
      created_by_person_id text references people(id) on delete set null,
      last_login_at timestamptz,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create table if not exists bill_chats (
      id text primary key,
      person_id text not null references people(id) on delete cascade,
      title text not null,
      agent_session_file text,
      people jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `

  await sql`
    alter table bill_chats
    add column if not exists agent_session_file text
  `

  await sql`
    create index if not exists bill_chats_person_id_updated_at_idx
    on bill_chats (person_id, updated_at desc)
  `

  await sql`
    update bill_chats
    set people = (people #>> '{}')::jsonb
    where jsonb_typeof(people) = 'string'
  `

  await sql`
    create table if not exists groups (
      id text primary key,
      name text not null,
      icon text,
      background_color text,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    alter table groups
    add column if not exists icon text
  `

  await sql`
    alter table groups
    add column if not exists background_color text
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
      bill_date date,
      source_chat_id text references bill_chats(id) on delete set null,
      total_amount_cents integer not null,
      tip_amount_cents integer not null default 0,
      paid_by_person_id text not null references people(id),
      created_at timestamptz not null default now()
    )
  `

  await sql`
    alter table bills
    add column if not exists bill_date date
  `

  await sql`
    alter table bills
    add column if not exists source_chat_id text references bill_chats(id) on delete set null
  `

  await sql`
    update bills
    set bill_date = created_at::date
    where bill_date is null
  `

  await sql`
    create index if not exists bills_source_chat_id_idx
    on bills (source_chat_id)
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

  await sql`
    alter table people
    add column if not exists email text
  `

  await sql`
    alter table people
    add column if not exists google_sub text
  `

  await sql`
    alter table people
    add column if not exists avatar_url text
  `

  await sql`
    alter table people
    add column if not exists created_by_person_id text references people(id) on delete set null
  `

  await sql`
    alter table people
    add column if not exists last_login_at timestamptz
  `

  await sql`
    create unique index if not exists people_google_sub_unique_idx
    on people (google_sub)
    where google_sub is not null
  `

  await sql`
    create unique index if not exists people_email_unique_idx
    on people (email)
    where email is not null
  `

  await sql`
    create index if not exists people_created_by_person_id_idx
    on people (created_by_person_id)
  `

  await sql`
    alter table bill_runs
    add column if not exists person_id text references people(id) on delete cascade
  `

  await sql`
    alter table bill_runs
    add column if not exists chat_id text references bill_chats(id) on delete cascade
  `

  await sql`
    update bill_runs
    set payload = (payload #>> '{}')::jsonb
    where jsonb_typeof(payload) = 'string'
  `

  await sql`
    create index if not exists bill_runs_person_id_idx
    on bill_runs (person_id, created_at desc)
  `

  await sql`
    create index if not exists bill_runs_chat_id_idx
    on bill_runs (chat_id, created_at desc)
  `
}
