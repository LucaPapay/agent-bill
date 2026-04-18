import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  addLedgerPersonToGroup,
  createLedgerBill,
  createLedgerGroup,
  deleteLedgerBill,
  getLedger,
  recordSettlementPayment,
  undoSettlementPayment,
  updateLedgerBill,
} from '../lib/ledger/service'
import { buildBillLedger } from '../lib/group-ledger'
import { db, ensureSchema } from '../lib/db/client'
import { createPerson, assertPersonCanAccessGroup, getGroupMemberIds } from '../lib/db/groups'

const server = new McpServer({
  name: 'agent-bill',
  version: '0.1.0',
})

const billItemSchema = z.object({
  amountCents: z.number().int().positive(),
  assignedPersonIds: z.array(z.string().trim().min(1)).min(1),
  name: z.string().trim().min(1),
})

function asText(payload: unknown) {
  if (typeof payload === 'string') {
    return payload
  }

  return JSON.stringify(payload, null, 2)
}

function ok(payload: unknown) {
  return {
    content: [{
      type: 'text' as const,
      text: asText(payload),
    }],
  }
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error')

  return {
    content: [{
      type: 'text' as const,
      text: message,
    }],
    isError: true,
  }
}

function run(action: () => Promise<unknown>) {
  return Promise.resolve()
    .then(action)
    .then(ok)
    .catch(fail)
}

function requirePersonId(personId?: null | string) {
  const resolved = String(personId || process.env.AGENT_BILL_PERSON_ID || '').trim()

  if (!resolved) {
    throw new Error('Pass personId or set AGENT_BILL_PERSON_ID before using this tool.')
  }

  return resolved
}

async function findPeople(query?: string) {
  await ensureSchema()

  const normalizedQuery = String(query || '').trim().toLowerCase()

  const rows = normalizedQuery
    ? await db()`
      select id, name, email, created_at
      from people
      where lower(name) like ${`%${normalizedQuery}%`}
        or lower(coalesce(email, '')) like ${`%${normalizedQuery}%`}
      order by lower(name) asc, created_at asc
      limit 25
    `
    : await db()`
      select id, name, email, created_at
      from people
      order by lower(name) asc, created_at asc
      limit 25
    `

  return rows.map((row: any) => ({
    createdAt: row.created_at,
    email: row.email || '',
    id: row.id,
    name: row.name,
  }))
}

server.registerTool(
  'find_people',
  {
    description: 'List or search local people so you can pick a personId for later ledger actions.',
    inputSchema: {
      query: z.string().trim().optional(),
    },
  },
  ({ query }) => run(() => findPeople(query)),
)

server.registerTool(
  'create_person',
  {
    description: 'Create a new local person. Use createdByPersonId when the new person should be visible to an existing local user.',
    inputSchema: {
      createdByPersonId: z.string().trim().optional(),
      name: z.string().trim().min(1),
    },
  },
  ({ createdByPersonId, name }) => run(async () => {
    return await createPerson(name, createdByPersonId || null)
  }),
)

server.registerTool(
  'get_ledger',
  {
    description: 'Fetch the full ledger snapshot for the acting local person.',
    inputSchema: {
      personId: z.string().trim().optional(),
    },
  },
  ({ personId }) => run(async () => {
    return await getLedger(requirePersonId(personId))
  }),
)

server.registerTool(
  'create_group',
  {
    description: 'Create a new group for the acting local person and add them as the first member.',
    inputSchema: {
      name: z.string().trim().min(1),
      personId: z.string().trim().optional(),
    },
  },
  ({ name, personId }) => run(async () => {
    return await createLedgerGroup(name, requirePersonId(personId))
  }),
)

server.registerTool(
  'add_person_to_group',
  {
    description: 'Add an existing person to a group the acting local person can access.',
    inputSchema: {
      groupId: z.string().trim().min(1),
      personId: z.string().trim().optional(),
      targetPersonId: z.string().trim().min(1),
    },
  },
  ({ groupId, personId, targetPersonId }) => run(async () => {
    return await addLedgerPersonToGroup(requirePersonId(personId), groupId, targetPersonId)
  }),
)

server.registerTool(
  'preview_bill_split',
  {
    description: 'Preview the calculated shares and transfers for a bill before saving it.',
    inputSchema: {
      billItems: z.array(billItemSchema),
      groupId: z.string().trim().min(1),
      paidByPersonId: z.string().trim().min(1),
      personId: z.string().trim().optional(),
      tipAmountCents: z.number().int().min(0),
      totalAmountCents: z.number().int().min(0),
    },
  },
  ({ billItems, groupId, paidByPersonId, personId, tipAmountCents, totalAmountCents }) => run(async () => {
    const actingPersonId = requirePersonId(personId)

    await assertPersonCanAccessGroup(actingPersonId, groupId)

    const groupMemberIds = await getGroupMemberIds(groupId)
    const preview = buildBillLedger({
      billItems,
      groupMemberIds,
      paidByPersonId,
      tipAmountCents,
      totalAmountCents,
    })

    return {
      groupId,
      groupMemberIds,
      ...preview,
    }
  }),
)

server.registerTool(
  'create_bill',
  {
    description: 'Create a bill with item-level split assignments for a group.',
    inputSchema: {
      billDate: z.string().trim(),
      billItems: z.array(billItemSchema),
      groupId: z.string().trim().min(1),
      paidByPersonId: z.string().trim().min(1),
      personId: z.string().trim().optional(),
      tipAmountCents: z.number().int().min(0),
      title: z.string().trim().min(1),
      totalAmountCents: z.number().int().min(0),
    },
  },
  ({ billDate, billItems, groupId, paidByPersonId, personId, tipAmountCents, title, totalAmountCents }) => run(async () => {
    return await createLedgerBill(requirePersonId(personId), {
      billDate,
      billItems,
      groupId,
      paidByPersonId,
      tipAmountCents,
      title,
      totalAmountCents,
    })
  }),
)

server.registerTool(
  'update_bill',
  {
    description: 'Replace a saved bill with a new item-level split configuration.',
    inputSchema: {
      billDate: z.string().trim(),
      billId: z.string().trim().min(1),
      billItems: z.array(billItemSchema),
      groupId: z.string().trim().min(1),
      paidByPersonId: z.string().trim().min(1),
      personId: z.string().trim().optional(),
      tipAmountCents: z.number().int().min(0),
      title: z.string().trim().min(1),
      totalAmountCents: z.number().int().min(0),
    },
  },
  ({ billDate, billId, billItems, groupId, paidByPersonId, personId, tipAmountCents, title, totalAmountCents }) => run(async () => {
    return await updateLedgerBill(requirePersonId(personId), {
      billDate,
      billId,
      billItems,
      groupId,
      paidByPersonId,
      tipAmountCents,
      title,
      totalAmountCents,
    })
  }),
)

server.registerTool(
  'delete_bill',
  {
    description: 'Delete a bill when there are no active settlement payments blocking that edit.',
    inputSchema: {
      billId: z.string().trim().min(1),
      personId: z.string().trim().optional(),
    },
  },
  ({ billId, personId }) => run(async () => {
    return await deleteLedgerBill(requirePersonId(personId), billId)
  }),
)

server.registerTool(
  'record_settlement_payment',
  {
    description: 'Record a payment against an open simplified settlement edge inside a group.',
    inputSchema: {
      amountCents: z.number().int().positive(),
      fromPersonId: z.string().trim().min(1),
      groupId: z.string().trim().min(1),
      personId: z.string().trim().optional(),
      toPersonId: z.string().trim().min(1),
    },
  },
  ({ amountCents, fromPersonId, groupId, personId, toPersonId }) => run(async () => {
    return await recordSettlementPayment(requirePersonId(personId), {
      amountCents,
      fromPersonId,
      groupId,
      toPersonId,
    })
  }),
)

server.registerTool(
  'undo_settlement_payment',
  {
    description: 'Void a previously recorded settlement payment.',
    inputSchema: {
      paymentId: z.string().trim().min(1),
      personId: z.string().trim().optional(),
    },
  },
  ({ paymentId, personId }) => run(async () => {
    return await undoSettlementPayment(requirePersonId(personId), paymentId)
  }),
)

await server.connect(new StdioServerTransport())
