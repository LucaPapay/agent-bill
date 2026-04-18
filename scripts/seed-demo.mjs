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
          { amountCents: 1300, assignedPeople: ['Jojo'], name: 'Al pastor tacos' },
          { amountCents: 1250, assignedPeople: ['Alice'], name: 'Mushroom tacos' },
          { amountCents: 1450, assignedPeople: ['Bob'], name: 'Carnitas tacos' },
          { amountCents: 1500, assignedPeople: ['Cara'], name: 'Fish taco plate' },
          { amountCents: 1550, assignedPeople: ['Diego'], name: 'Birria tacos' },
          { amountCents: 1350, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Chips and guac' },
        ],
        paidBy: 'Jojo',
        tipAmountCents: 1200,
        title: 'Taco Meteor Tuesday',
      },
      {
        items: [
          { amountCents: 900, assignedPeople: ['Alice'], name: 'Chili wontons' },
          { amountCents: 1200, assignedPeople: ['Jojo'], name: 'Pork soup dumplings' },
          { amountCents: 1300, assignedPeople: ['Bob'], name: 'Shrimp dumplings' },
          { amountCents: 1150, assignedPeople: ['Cara'], name: 'Mushroom dumplings' },
          { amountCents: 1450, assignedPeople: ['Diego'], name: 'Beef noodle bowl' },
          { amountCents: 900, assignedPeople: ['Jojo', 'Diego'], name: 'Sesame cucumbers' },
          { amountCents: 700, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Oolong pot' },
        ],
        paidBy: 'Cara',
        tipAmountCents: 900,
        title: 'Dumpling Diplomacy',
      },
      {
        items: [
          { amountCents: 700, assignedPeople: ['Diego'], name: 'Pistachio gelato' },
          { amountCents: 700, assignedPeople: ['Cara'], name: 'Lemon sorbet' },
          { amountCents: 600, assignedPeople: ['Alice'], name: 'Stracciatella cup' },
          { amountCents: 650, assignedPeople: ['Bob'], name: 'Hazelnut gelato' },
          { amountCents: 800, assignedPeople: ['Jojo'], name: 'Espresso affogato' },
        ],
        paidBy: 'Diego',
        tipAmountCents: 400,
        title: 'Midnight Gelato Draft',
      },
      {
        items: [
          { amountCents: 1700, assignedPeople: ['Bob'], name: 'Tonkotsu ramen' },
          { amountCents: 1600, assignedPeople: ['Alice'], name: 'Spicy miso ramen' },
          { amountCents: 1500, assignedPeople: ['Cara'], name: 'Tofu miso ramen' },
          { amountCents: 1650, assignedPeople: ['Diego'], name: 'Karaage curry' },
          { amountCents: 1750, assignedPeople: ['Jojo'], name: 'Tantanmen' },
          { amountCents: 1200, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Gyoza basket' },
          { amountCents: 450, assignedPeople: ['Diego'], name: 'Melon soda' },
          { amountCents: 650, assignedPeople: ['Jojo'], name: 'Yuzu highball' },
        ],
        paidBy: 'Bob',
        tipAmountCents: 1000,
        title: 'Karaoke Noodles',
      },
      {
        items: [
          { amountCents: 2400, assignedPeople: ['Jojo'], name: 'Truffle rigatoni' },
          { amountCents: 1900, assignedPeople: ['Alice'], name: 'Cacio e pepe' },
          { amountCents: 1900, assignedPeople: ['Bob'], name: 'Lemon spaghetti' },
          { amountCents: 2000, assignedPeople: ['Cara'], name: 'Vodka penne' },
          { amountCents: 2100, assignedPeople: ['Diego'], name: 'Mushroom tagliatelle' },
          { amountCents: 1500, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Burrata cloud' },
          { amountCents: 1100, assignedPeople: ['Cara', 'Diego'], name: 'Olive oil cake' },
        ],
        paidBy: 'Alice',
        tipAmountCents: 1400,
        title: 'Rooftop Pasta Summit',
      },
      {
        items: [
          { amountCents: 950, assignedPeople: ['Jojo'], name: 'Blueberry pancake stack' },
          { amountCents: 850, assignedPeople: ['Alice'], name: 'Egg sandwich' },
          { amountCents: 700, assignedPeople: ['Bob'], name: 'Flat white' },
          { amountCents: 1100, assignedPeople: ['Cara'], name: 'Banana pancakes' },
          { amountCents: 1000, assignedPeople: ['Diego'], name: 'Shakshuka toast' },
          { amountCents: 600, assignedPeople: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'], name: 'Hash brown basket' },
        ],
        paidBy: 'Jojo',
        tipAmountCents: 600,
        title: 'Pancake Truce',
      },
      {
        items: [
          { amountCents: 1600, assignedPeople: ['Jojo'], name: 'Salmon avocado roll' },
          { amountCents: 900, assignedPeople: ['Alice'], name: 'Cucumber roll' },
          { amountCents: 1500, assignedPeople: ['Bob'], name: 'Spicy tuna roll' },
          { amountCents: 950, assignedPeople: ['Cara'], name: 'Tofu hand roll' },
          { amountCents: 1800, assignedPeople: ['Diego'], name: 'Eel roll' },
          { amountCents: 1400, assignedPeople: ['Alice', 'Bob'], name: 'Crispy rice duo' },
          { amountCents: 300, assignedPeople: ['Jojo'], name: 'Ginger ale' },
          { amountCents: 300, assignedPeople: ['Cara'], name: 'Matcha fizz' },
          { amountCents: 300, assignedPeople: ['Diego'], name: 'Yuzu soda' },
        ],
        paidBy: 'Diego',
        tipAmountCents: 1300,
        title: 'Neon Sushi Sprint',
      },
    ],
    backgroundColor: '#F6C453',
    icon: '🍷',
    members: ['Jojo', 'Alice', 'Bob', 'Cara', 'Diego'],
    name: 'Moonlight Supper Club',
  },
  {
    billSpecs: [
      {
        items: [
          { amountCents: 1200, assignedPeople: ['Jojo'], name: 'Pepperoni slices' },
          { amountCents: 1100, assignedPeople: ['Esme'], name: 'Margherita slices' },
          { amountCents: 1300, assignedPeople: ['Farah'], name: 'Hot honey slices' },
          { amountCents: 1250, assignedPeople: ['Gus'], name: 'Mushroom slices' },
          { amountCents: 900, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Garlic knots' },
          { amountCents: 800, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Caesar salad bowl' },
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
          { amountCents: 1200, assignedPeople: ['Esme'], name: 'Halloumi skewer plate' },
          { amountCents: 1100, assignedPeople: ['Farah'], name: 'Veggie skewer plate' },
          { amountCents: 1300, assignedPeople: ['Gus'], name: 'Merguez skewer plate' },
          { amountCents: 500, assignedPeople: ['Jojo'], name: 'Charred corn cup' },
          { amountCents: 700, assignedPeople: ['Jojo'], name: 'Peach soda' },
          { amountCents: 400, assignedPeople: ['Gus'], name: 'Cola can' },
          { amountCents: 700, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Corn salad bowl' },
          { amountCents: 600, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Marshmallow bag' },
        ],
        paidBy: 'Farah',
        tipAmountCents: 900,
        title: 'Balcony BBQ Rehearsal',
      },
      {
        items: [
          { amountCents: 700, assignedPeople: ['Jojo'], name: 'Cookie dough scoop' },
          { amountCents: 900, assignedPeople: ['Gus'], name: 'Brownie sundae' },
          { amountCents: 700, assignedPeople: ['Esme'], name: 'Mango sorbet' },
          { amountCents: 900, assignedPeople: ['Farah'], name: 'Salted caramel swirl' },
          { amountCents: 400, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Waffle cone basket' },
        ],
        paidBy: 'Jojo',
        tipAmountCents: 300,
        title: 'Laundry Night Ice Cream',
      },
      {
        items: [
          { amountCents: 1100, assignedPeople: ['Esme'], name: 'Shakshuka skillet' },
          { amountCents: 1000, assignedPeople: ['Farah'], name: 'Shakshuka skillet' },
          { amountCents: 800, assignedPeople: ['Jojo'], name: 'Avocado toast' },
          { amountCents: 800, assignedPeople: ['Gus'], name: 'Ricotta toast' },
          { amountCents: 1200, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Tomato jam board' },
          { amountCents: 450, assignedPeople: ['Jojo'], name: 'Sparkling orange spritz' },
          { amountCents: 450, assignedPeople: ['Farah'], name: 'Mint lemonade' },
        ],
        paidBy: 'Esme',
        tipAmountCents: 1000,
        title: 'Plant Parent Brunch',
      },
      {
        items: [
          { amountCents: 500, assignedPeople: ['Jojo'], name: 'Chili chips' },
          { amountCents: 650, assignedPeople: ['Esme'], name: 'Dark chocolate' },
          { amountCents: 550, assignedPeople: ['Farah'], name: 'Sea salt popcorn' },
          { amountCents: 400, assignedPeople: ['Gus'], name: 'Gummy bears' },
          { amountCents: 400, assignedPeople: ['Jojo', 'Esme', 'Farah', 'Gus'], name: 'Sparkling water pack' },
        ],
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
    backgroundColor: '#B9E3C6',
    icon: '🏠',
    members: ['Jojo', 'Esme', 'Farah', 'Gus'],
    name: 'Studio House League',
  },
  {
    billSpecs: [
      {
        items: [
          { amountCents: 500, assignedPeople: ['Bob'], name: 'Hot chocolate' },
          { amountCents: 450, assignedPeople: ['Cara'], name: 'Chai latte' },
          { amountCents: 550, assignedPeople: ['Hana'], name: 'Hot cocoa' },
          { amountCents: 500, assignedPeople: ['Ivo'], name: 'Mulled cider' },
          { amountCents: 500, assignedPeople: ['Jojo'], name: 'Brownie' },
        ],
        paidBy: 'Hana',
        tipAmountCents: 500,
        title: 'Cabin Cocoa Emergency',
      },
      {
        items: [
          { amountCents: 900, assignedPeople: ['Ivo'], name: 'Ham panini' },
          { amountCents: 800, assignedPeople: ['Hana'], name: 'Mozzarella panini' },
          { amountCents: 950, assignedPeople: ['Bob'], name: 'Salami panini' },
          { amountCents: 700, assignedPeople: ['Jojo'], name: 'Tomato soup cup' },
          { amountCents: 600, assignedPeople: ['Cara'], name: 'Ski fries' },
          { amountCents: 900, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Snow fries' },
          { amountCents: 550, assignedPeople: ['Bob'], name: 'Berry fizz' },
          { amountCents: 550, assignedPeople: ['Cara'], name: 'Berry fizz' },
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
          { amountCents: 900, assignedPeople: ['Bob'], name: 'Sledding goulash bowl' },
          { amountCents: 900, assignedPeople: ['Ivo'], name: 'Sledding goulash bowl' },
          { amountCents: 550, assignedPeople: ['Cara'], name: 'Dumpling broth' },
          { amountCents: 550, assignedPeople: ['Hana'], name: 'Dumpling broth' },
          { amountCents: 700, assignedPeople: ['Jojo'], name: 'Tomato soup' },
          { amountCents: 900, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Pretzel basket' },
        ],
        paidBy: 'Bob',
        tipAmountCents: 700,
        title: 'Sledding Soup Run',
      },
      {
        items: [
          { amountCents: 250, assignedPeople: ['Bob'], name: 'Blood orange soda' },
          { amountCents: 250, assignedPeople: ['Cara'], name: 'Grapefruit soda' },
          { amountCents: 300, assignedPeople: ['Hana'], name: 'Herb tea' },
          { amountCents: 300, assignedPeople: ['Ivo'], name: 'Apple spritzer' },
          { amountCents: 300, assignedPeople: ['Jojo'], name: 'Mint tea' },
          { amountCents: 350, assignedPeople: ['Bob'], name: 'Honey cake slice' },
          { amountCents: 400, assignedPeople: ['Cara'], name: 'Honey cake slice' },
          { amountCents: 350, assignedPeople: ['Ivo'], name: 'Honey cake slice' },
        ],
        paidBy: 'Cara',
        tipAmountCents: 400,
        title: 'Sauna Citrus Round',
      },
      {
        items: [
          { amountCents: 900, assignedPeople: ['Bob'], name: 'Rosti plate' },
          { amountCents: 850, assignedPeople: ['Cara'], name: 'Berry pancakes' },
          { amountCents: 850, assignedPeople: ['Hana'], name: 'Berry pancakes' },
          { amountCents: 800, assignedPeople: ['Ivo'], name: 'Rosti plate' },
          { amountCents: 900, assignedPeople: ['Jojo'], name: 'Poached eggs toast' },
          { amountCents: 450, assignedPeople: ['Bob'], name: 'Flat white' },
          { amountCents: 450, assignedPeople: ['Ivo'], name: 'Cappuccino' },
          { amountCents: 400, assignedPeople: ['Jojo'], name: 'Espresso' },
          { amountCents: 600, assignedPeople: ['Bob', 'Cara', 'Hana', 'Ivo', 'Jojo'], name: 'Jam jar trio' },
        ],
        paidBy: 'Jojo',
        tipAmountCents: 1100,
        title: 'Summit Sunrise Breakfast',
      },
    ],
    backgroundColor: '#A9D4F2',
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

function formatRelativeBillDate(daysAgo) {
  const value = new Date()
  value.setHours(12, 0, 0, 0)
  value.setDate(value.getDate() - daysAgo)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeBillSpec(groupName, billSpec, peopleByName, billDate) {
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
    billDate,
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
    update bills
    set bill_date = created_at::date
    where bill_date is null
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
        insert into groups (id, name, icon, background_color, created_at)
        values (
          ${groupId},
          ${group.name},
          ${group.icon},
          ${group.backgroundColor || null},
          ${timestampMinutesAgo(3000 - (groupIndex * 10))}
        )
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

      for (const [billOffset, billSpec] of group.billSpecs.entries()) {
        billIndex += 1

        const bill = normalizeBillSpec(
          group.name,
          billSpec,
          peopleByName,
          formatRelativeBillDate((groupIndex * 9) + (billOffset * 4) + 1),
        )
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
            bill_date,
            total_amount_cents,
            tip_amount_cents,
            paid_by_person_id,
            created_at
          )
          values (
            ${billId},
            ${groupId},
            ${bill.title},
            ${bill.billDate},
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
