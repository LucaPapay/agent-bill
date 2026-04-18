import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL || 'postgresql://agent_bill:agent_bill@127.0.0.1:5432/agent_bill'
const sql = postgres(databaseUrl, {
  max: 1,
  onnotice() {},
})

const demoPeople = [
  { email: 'jojo.rossi@example.com', key: 'Jojo', name: 'Jojo Rossi' },
  { email: 'alice.nguyen@example.com', key: 'Alice', name: 'Alice Nguyen' },
  { email: 'bob.martin@example.com', key: 'Bob', name: 'Bob Martin' },
  { email: 'cara.oliveira@example.com', key: 'Cara', name: 'Cara Oliveira' },
  { email: 'diego.santos@example.com', key: 'Diego', name: 'Diego Santos' },
  { email: 'esme.dubois@example.com', key: 'Esme', name: 'Esme Dubois' },
  { email: 'farah.haddad@example.com', key: 'Farah', name: 'Farah Haddad' },
  { email: 'gus.petrov@example.com', key: 'Gus', name: 'Gus Petrov' },
  { email: 'hana.kovac@example.com', key: 'Hana', name: 'Hana Kovac' },
  { email: 'ivo.markovic@example.com', key: 'Ivo', name: 'Ivo Markovic' },
]

const demoGroups = [
  {
    billSpecs: [
      {
        items: [
          { amountCents: 3200, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Firecracker tacos' },
          { amountCents: 1600, assignedPeople: ['Alice', 'Cara', 'Diego'], name: 'Lime soda tower' },
          { amountCents: 900, assignedPeople: ['Jojo', 'Alice'], name: 'Churro landing pad' },
          { amountCents: 1100, assignedPeople: ['Bob', 'Diego'], name: 'Mystery hot sauce flight' },
        ],
        paidBy: 'Jojo',
        tipAmountCents: 1200,
        title: 'Taco Meteor Tuesday',
      },
      {
        items: [
          { amountCents: 1800, assignedPeople: ['Alice', 'Bob', 'Cara'], name: 'Chili wontons' },
          { amountCents: 2100, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Soup dumplings' },
          { amountCents: 900, assignedPeople: ['Diego', 'Jojo'], name: 'Sesame cucumbers' },
          { amountCents: 700, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Oolong pot' },
        ],
        paidBy: 'Cara',
        tipAmountCents: 900,
        title: 'Dumpling Diplomacy',
      },
      {
        items: [
          { amountCents: 700, assignedPeople: ['Diego'], name: 'Pistachio comet' },
          { amountCents: 700, assignedPeople: ['Cara'], name: 'Lemon cloud scoop' },
          { amountCents: 1200, assignedPeople: ['Alice', 'Bob'], name: 'Stracciatella duet' },
          { amountCents: 800, assignedPeople: ['Jojo'], name: 'Espresso affogato' },
        ],
        paidBy: 'Diego',
        tipAmountCents: 400,
        title: 'Midnight Gelato Draft',
      },
      {
        items: [
          { amountCents: 1700, assignedPeople: ['Bob'], name: 'Thunder ramen' },
          { amountCents: 1500, assignedPeople: ['Alice', 'Cara'], name: 'Vegan miso glow' },
          { amountCents: 1200, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Gyoza parade' },
          { amountCents: 900, assignedPeople: ['Diego', 'Jojo', 'Bob'], name: 'Melon soda trio' },
        ],
        paidBy: 'Bob',
        tipAmountCents: 1000,
        title: 'Karaoke Noodles',
      },
      {
        items: [
          { amountCents: 2400, assignedPeople: ['Alice', 'Jojo'], name: 'Truffle rigatoni' },
          { amountCents: 1900, assignedPeople: ['Bob', 'Cara', 'Diego'], name: 'Lemon spaghetti' },
          { amountCents: 1500, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Burrata cloud' },
          { amountCents: 1100, assignedPeople: ['Cara', 'Diego'], name: 'Olive oil cake' },
        ],
        paidBy: 'Alice',
        tipAmountCents: 1400,
        title: 'Rooftop Pasta Summit',
      },
      {
        evenSplitSubtotalCents: 3600,
        paidBy: 'Jojo',
        tipAmountCents: 600,
        title: 'Pancake Truce',
      },
      {
        items: [
          { amountCents: 2600, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Rainbow rolls' },
          { amountCents: 1400, assignedPeople: ['Alice', 'Bob'], name: 'Crispy rice duo' },
          { amountCents: 900, assignedPeople: ['Cara', 'Diego', 'Jojo'], name: 'Matcha fizz' },
          { amountCents: 1800, assignedPeople: ['Bob', 'Diego'], name: 'Eel surprise' },
        ],
        paidBy: 'Diego',
        tipAmountCents: 1300,
        title: 'Neon Sushi Sprint',
      },
    ],
    icon: '🍷',
    members: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'],
    name: 'Moonlight Supper Club',
  },
  {
    billSpecs: [
      {
        items: [
          { amountCents: 2200, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Meteor margherita' },
          { amountCents: 2400, assignedPeople: ['Jojo', 'Farah', 'Gus'], name: 'Chili honey pie' },
          { amountCents: 900, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Garlic knots' },
        ],
        paidBy: 'Gus',
        tipAmountCents: 800,
        title: 'Sofa Pizza Summit',
      },
      {
        evenSplitSubtotalCents: 7200,
        paidBy: 'Esme',
        tipAmountCents: 0,
        title: 'Neon Groceries',
      },
      {
        items: [
          { amountCents: 1800, assignedPeople: ['Esme', 'Farah', 'Gus'], name: 'Halloumi skewers' },
          { amountCents: 1200, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Corn confetti' },
          { amountCents: 1400, assignedPeople: ['Jojo', 'Gus'], name: 'Peach soda crate' },
          { amountCents: 800, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Marshmallow volley' },
        ],
        paidBy: 'Farah',
        tipAmountCents: 900,
        title: 'Balcony BBQ Rehearsal',
      },
      {
        items: [
          { amountCents: 900, assignedPeople: ['Jojo', 'Gus'], name: 'Cookie dough tub' },
          { amountCents: 700, assignedPeople: ['Esme'], name: 'Mango sorbet' },
          { amountCents: 900, assignedPeople: ['Farah', 'Esme'], name: 'Salted caramel swirl' },
          { amountCents: 300, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Sprinkles refill' },
        ],
        paidBy: 'Jojo',
        tipAmountCents: 300,
        title: 'Laundry Night Ice Cream',
      },
      {
        items: [
          { amountCents: 2100, assignedPeople: ['Esme', 'Farah'], name: 'Shakshuka skillet' },
          { amountCents: 1600, assignedPeople: ['Jojo', 'Gus'], name: 'Cloud toast' },
          { amountCents: 1200, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Tomato jam board' },
          { amountCents: 900, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Sparkling orange pitcher' },
        ],
        paidBy: 'Esme',
        tipAmountCents: 1000,
        title: 'Plant Parent Brunch',
      },
      {
        evenSplitSubtotalCents: 2500,
        paidBy: 'Gus',
        tipAmountCents: 500,
        title: 'Mystery Snack Raid',
      },
      {
        items: [
          { amountCents: 1800, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Mega detergent' },
          { amountCents: 1500, assignedPeople: ['Jojo', 'Farah', 'Gus'], name: 'LED strip refill' },
          { amountCents: 900, assignedPeople: ['Esme', 'Farah'], name: 'Velvet hangers' },
        ],
        paidBy: 'Farah',
        tipAmountCents: 0,
        title: 'Detergent & Disco Lights',
      },
    ],
    icon: '🏠',
    members: ['Jojo', 'Esme', 'Farah', 'Gus'],
    name: 'Studio House League',
  },
  {
    billSpecs: [
      {
        evenSplitSubtotalCents: 2500,
        paidBy: 'Hana',
        tipAmountCents: 500,
        title: 'Cabin Cocoa Emergency',
      },
      {
        items: [
          { amountCents: 2100, assignedPeople: ['Ivo', 'Hana', 'Bob'], name: 'Gondola panini stack' },
          { amountCents: 1500, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Snow fries' },
          { amountCents: 1100, assignedPeople: ['Bob', 'Cara', 'Jojo'], name: 'Berry fizz' },
        ],
        paidBy: 'Ivo',
        tipAmountCents: 900,
        title: 'Gondola Sandwich Treaty',
      },
      {
        items: [
          { amountCents: 3200, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Cheese cauldron' },
          { amountCents: 900, assignedPeople: ['Hana', 'Cara'], name: 'Pear slices' },
          { amountCents: 700, assignedPeople: ['Ivo', 'Bob', 'Jojo'], name: 'Kirsch splash' },
          { amountCents: 1400, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Chocolate finale' },
        ],
        paidBy: 'Jojo',
        tipAmountCents: 1600,
        title: 'Starlight Fondue Summit',
      },
      {
        items: [
          { amountCents: 1800, assignedPeople: ['Bob', 'Ivo'], name: 'Sledding goulash bowl' },
          { amountCents: 1600, assignedPeople: ['Cara', 'Hana', 'Jojo'], name: 'Dumpling broth' },
          { amountCents: 900, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Pretzel basket' },
        ],
        paidBy: 'Bob',
        tipAmountCents: 700,
        title: 'Sledding Soup Run',
      },
      {
        items: [
          { amountCents: 800, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Blood orange crate' },
          { amountCents: 900, assignedPeople: ['Hana', 'Jojo', 'Cara'], name: 'Herb tea tower' },
          { amountCents: 1100, assignedPeople: ['Bob', 'Ivo', 'Cara'], name: 'Honey cake slab' },
        ],
        paidBy: 'Cara',
        tipAmountCents: 400,
        title: 'Sauna Citrus Round',
      },
      {
        items: [
          { amountCents: 2200, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Rosti mountain' },
          { amountCents: 1700, assignedPeople: ['Cara', 'Hana'], name: 'Berry pancakes' },
          { amountCents: 1300, assignedPeople: ['Bob', 'Ivo', 'Jojo'], name: 'Coffee orbit' },
          { amountCents: 600, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Jam jar trio' },
        ],
        paidBy: 'Jojo',
        tipAmountCents: 1100,
        title: 'Summit Sunrise Breakfast',
      },
    ],
    icon: '🏔️',
    members: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'],
    name: 'Alpine Escape 2026',
  },
]

await ensureSchema()
await seedDemoLedger()
await sql.end()

function splitEvenly(amountCents, personIds) {
  if (!personIds.length || amountCents <= 0) {
    return new Map()
  }

  const base = Math.floor(amountCents / personIds.length)
  const remainder = amountCents % personIds.length
  const result = new Map()

  for (const [index, personId] of personIds.entries()) {
    result.set(personId, base + (index < remainder ? 1 : 0))
  }

  return result
}

function buildBillLedger({ billItems, groupMemberIds, paidByPersonId, tipAmountCents, totalAmountCents }) {
  if (!groupMemberIds.length) {
    throw new Error('Demo seed group is missing members.')
  }

  const groupMemberIdsSet = new Set(groupMemberIds)

  if (!groupMemberIdsSet.has(paidByPersonId)) {
    throw new Error('Demo seed payer must belong to the group.')
  }

  if (tipAmountCents > totalAmountCents) {
    throw new Error('Demo seed tip cannot exceed the total.')
  }

  const itemAmountsByPersonId = new Map(groupMemberIds.map(personId => [personId, 0]))
  const itemSubtotalCents = totalAmountCents - tipAmountCents

  if (!billItems.length) {
    const evenItemAmounts = splitEvenly(itemSubtotalCents, groupMemberIds)

    for (const personId of groupMemberIds) {
      itemAmountsByPersonId.set(personId, evenItemAmounts.get(personId) || 0)
    }
  }

  for (const item of billItems) {
    const amountCents = Math.max(0, Math.round(item.amountCents))
    const assignedPersonIds = [...new Set(item.assignedPersonIds)]

    if (!amountCents || !assignedPersonIds.length) {
      continue
    }

    for (const personId of assignedPersonIds) {
      if (!groupMemberIdsSet.has(personId)) {
        throw new Error(`Demo seed item "${item.name}" points at someone outside the group.`)
      }
    }

    const splitAmounts = splitEvenly(amountCents, assignedPersonIds)

    for (const personId of assignedPersonIds) {
      itemAmountsByPersonId.set(
        personId,
        (itemAmountsByPersonId.get(personId) || 0) + (splitAmounts.get(personId) || 0),
      )
    }
  }

  const memberShares = groupMemberIds.map(personId => ({
    itemAmountCents: itemAmountsByPersonId.get(personId) || 0,
    personId,
    tipAmountCents: 0,
    totalAmountCents: 0,
  }))

  const tipParticipants = memberShares
    .filter(share => share.itemAmountCents > 0)
    .map(share => share.personId)
  const sharedTip = splitEvenly(tipAmountCents, tipParticipants.length ? tipParticipants : groupMemberIds)

  for (const share of memberShares) {
    share.tipAmountCents = sharedTip.get(share.personId) || 0
    share.totalAmountCents = share.itemAmountCents + share.tipAmountCents
  }

  const transfers = memberShares
    .filter(share => share.personId !== paidByPersonId && share.totalAmountCents > 0)
    .map(share => ({
      amountCents: share.totalAmountCents,
      fromPersonId: share.personId,
      toPersonId: paidByPersonId,
    }))

  return { memberShares, transfers }
}

function timestampMinutesAgo(minutesAgo) {
  return new Date(Date.now() - (minutesAgo * 60 * 1000))
}

function normalizeBillSpec(groupName, billSpec, peopleByName) {
  const billItems = (billSpec.items || []).map(item => ({
    amountCents: item.amountCents,
    assignedPersonIds: item.assignedPeople.map(name => {
      const personId = peopleByName.get(name)

      if (!personId) {
        throw new Error(`Unknown demo person "${name}" in ${groupName}.`)
      }

      return personId
    }),
    name: item.name,
  }))

  const subtotalFromItems = billItems.reduce((sum, item) => sum + item.amountCents, 0)
  const subtotalCents = typeof billSpec.evenSplitSubtotalCents === 'number'
    ? billSpec.evenSplitSubtotalCents
    : subtotalFromItems

  return {
    billItems,
    paidByPersonId: peopleByName.get(billSpec.paidBy),
    tipAmountCents: billSpec.tipAmountCents,
    title: billSpec.title,
    totalAmountCents: subtotalCents + billSpec.tipAmountCents,
  }
}

async function ensureSchema() {
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
    create table if not exists groups (
      id text primary key,
      name text not null,
      icon text,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    alter table groups
    add column if not exists icon text
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
      group_id text not null references groups(id) on delete cascade,
      from_person_id text not null references people(id),
      to_person_id text not null references people(id),
      amount_cents integer not null
    )
  `
}

async function seedDemoLedger() {
  const peopleCount = demoPeople.length
  const groupCount = demoGroups.length
  const billCount = demoGroups.reduce((sum, group) => sum + group.billSpecs.length, 0)

  await sql.begin(async (tx) => {
    await tx`delete from bill_runs`
    await tx`delete from bill_item_assignments`
    await tx`delete from bill_items`
    await tx`delete from bill_member_shares`
    await tx`delete from bill_transfers`
    await tx`delete from bills`
    await tx`delete from group_memberships`
    await tx`delete from groups`
    await tx`delete from people`

    const peopleByName = new Map()
    let personIndex = 0

    for (const person of demoPeople) {
      personIndex += 1
      const id = randomUUID()
      const createdAt = timestampMinutesAgo(5000 - personIndex)
      const lastLoginAt = timestampMinutesAgo(60 - personIndex)

      await tx`
        insert into people (id, name, email, last_login_at, created_at)
        values (${id}, ${person.name}, ${person.email}, ${lastLoginAt}, ${createdAt})
      `

      peopleByName.set(person.key, id)
    }

    let groupIndex = 0
    let membershipIndex = 0
    let billIndex = 0

    for (const group of demoGroups) {
      groupIndex += 1
      const groupId = randomUUID()

      await tx`
        insert into groups (id, name, icon, created_at)
        values (${groupId}, ${group.name}, ${group.icon}, ${timestampMinutesAgo(3000 - (groupIndex * 10))})
      `

      for (const memberName of group.members) {
        membershipIndex += 1

        await tx`
          insert into group_memberships (id, group_id, person_id, created_at)
          values (
            ${randomUUID()},
            ${groupId},
            ${peopleByName.get(memberName)},
            ${timestampMinutesAgo(2500 - membershipIndex)}
          )
        `
      }

      const groupMemberIds = group.members.map(name => peopleByName.get(name))

      for (const billSpec of group.billSpecs) {
        billIndex += 1

        const bill = normalizeBillSpec(group.name, billSpec, peopleByName)
        const { memberShares, transfers } = buildBillLedger({
          billItems: bill.billItems,
          groupMemberIds,
          paidByPersonId: bill.paidByPersonId,
          tipAmountCents: bill.tipAmountCents,
          totalAmountCents: bill.totalAmountCents,
        })
        const billId = randomUUID()
        const createdAt = timestampMinutesAgo(1200 - billIndex)

        await tx`
          insert into bills (
            id,
            group_id,
            title,
            total_amount_cents,
            tip_amount_cents,
            paid_by_person_id,
            created_at
          )
          values (
            ${billId},
            ${groupId},
            ${bill.title},
            ${bill.totalAmountCents},
            ${bill.tipAmountCents},
            ${bill.paidByPersonId},
            ${createdAt}
          )
        `

        for (const share of memberShares) {
          await tx`
            insert into bill_member_shares (
              id,
              bill_id,
              person_id,
              item_amount_cents,
              tip_amount_cents,
              total_amount_cents
            )
            values (
              ${randomUUID()},
              ${billId},
              ${share.personId},
              ${share.itemAmountCents},
              ${share.tipAmountCents},
              ${share.totalAmountCents}
            )
          `
        }

        for (const [itemOrder, item] of bill.billItems.entries()) {
          const billItemId = randomUUID()

          await tx`
            insert into bill_items (id, bill_id, name, amount_cents, sort_order)
            values (${billItemId}, ${billId}, ${item.name}, ${item.amountCents}, ${itemOrder})
          `

          for (const personId of item.assignedPersonIds) {
            await tx`
              insert into bill_item_assignments (id, bill_item_id, person_id)
              values (${randomUUID()}, ${billItemId}, ${personId})
            `
          }
        }

        for (const transfer of transfers) {
          await tx`
            insert into bill_transfers (id, bill_id, group_id, from_person_id, to_person_id, amount_cents)
            values (
              ${randomUUID()},
              ${billId},
              ${groupId},
              ${transfer.fromPersonId},
              ${transfer.toPersonId},
              ${transfer.amountCents}
            )
          `
        }
      }
    }
  })

  console.log('Seeded demo ledger')
  console.log('- cleared existing app data')
  console.log(`- ${peopleCount} people`)
  console.log(`- ${groupCount} groups`)
  console.log(`- ${billCount} bills`)

  for (const group of demoGroups) {
    console.log(`- ${group.name}: ${group.members.length} members, ${group.billSpecs.length} bills`)
  }
}
