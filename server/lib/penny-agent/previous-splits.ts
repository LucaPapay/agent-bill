import { normalizeExtractedReceipt, normalizePeople } from '../bill-analysis'
import { normalizeSavedRunPayload } from '../bill-run-payload'
import { getLedgerSnapshot } from '../db'
import { db, ensureSchema } from '../db/client'

const stopWords = new Set([
  'a',
  'an',
  'and',
  'bill',
  'for',
  'from',
  'receipt',
  'the',
  'with',
])

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeName(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function tokenize(value: unknown) {
  return unique(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length > 1 && !stopWords.has(token)),
  )
}

function countOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right)

  return left.reduce((count, value) => count + (rightSet.has(value) ? 1 : 0), 0)
}

function buildCandidateItemTokens(candidate: any) {
  return unique((candidate.billItems || []).flatMap((item: any) => tokenize(item.name)))
}

function buildReceiptItemTokens(receipt: any) {
  return unique((receipt?.items || []).flatMap((item: any) => tokenize(item.name)))
}

function buildSearchContext(input: any) {
  const normalizedPeople = normalizePeople(Array.isArray(input?.people) ? input.people : [])
  const receipt = input?.receipt ? normalizeExtractedReceipt(input.receipt) : null

  return {
    candidateLimit: Math.max(1, Math.min(5, Math.round(Number(input?.maxResults || 5)))),
    groupId: String(input?.groupId || '').trim(),
    merchantTokens: tokenize(receipt?.merchant || ''),
    people: normalizedPeople,
    peopleSet: new Set(normalizedPeople.map(normalizeName)),
    queryTokens: tokenize(input?.query || ''),
    receipt,
    receiptItemTokens: buildReceiptItemTokens(receipt),
    totalCents: Number(receipt?.totalCents || 0),
  }
}

function buildLedgerCandidates(ledger: any) {
  return (ledger?.groups || []).flatMap((group: any) =>
    (group?.bills || []).map((bill: any) => {
      const split = (bill?.shares || [])
        .filter((share: any) => Number(share?.totalAmountCents || 0) > 0)
        .map((share: any) => ({
          amountCents: Number(share.totalAmountCents || 0),
          note: '',
          person: String(share?.person?.name || '').trim(),
        }))
        .filter((entry: any) => entry.person)
      const people = normalizePeople([
        ...split.map((entry: any) => entry.person),
        String(bill?.paidByPerson?.name || '').trim(),
      ])

      return {
        billDate: String(bill?.billDate || '').trim(),
        billItems: (bill?.items || []).map((item: any) => ({
          amountCents: Number(item?.amountCents || 0),
          assignedPeople: normalizePeople((item?.assignedPeople || []).map((person: any) => person?.name)),
          name: String(item?.name || '').trim(),
        })).filter((item: any) => item.name),
        createdAt: bill?.createdAt,
        groupId: String(group?.id || '').trim(),
        groupName: String(group?.name || '').trim(),
        merchant: String(bill?.title || '').trim(),
        people,
        source: 'ledger_bill',
        sourceId: String(bill?.id || '').trim(),
        split,
        title: String(bill?.title || '').trim() || 'Untitled bill',
        totalCents: Number(bill?.totalAmountCents || 0),
      }
    }),
  )
}

async function loadSavedChatCandidates(personId: string, excludeChatId = '') {
  await ensureSchema()

  const normalizedChatId = String(excludeChatId || '').trim()
  const rows = normalizedChatId
    ? await db()`
      select
        chats.id as chat_id,
        chats.updated_at,
        runs.payload
      from bill_chats chats
      join lateral (
        select payload
        from bill_runs
        where chat_id = chats.id
        order by created_at desc
        limit 1
      ) runs on true
      where chats.person_id = ${personId}
        and chats.id <> ${normalizedChatId}
      order by chats.updated_at desc
      limit 80
    `
    : await db()`
      select
        chats.id as chat_id,
        chats.updated_at,
        runs.payload
      from bill_chats chats
      join lateral (
        select payload
        from bill_runs
        where chat_id = chats.id
        order by created_at desc
        limit 1
      ) runs on true
      where chats.person_id = ${personId}
      order by chats.updated_at desc
      limit 80
    `

  return rows
    .map((row: any) => {
      const payload = normalizeSavedRunPayload(row.payload)
      const split = Array.isArray(payload?.split)
        ? payload.split.map((entry: any) => ({
          amountCents: Number(entry?.amountCents || 0),
          note: String(entry?.note || '').trim(),
          person: String(entry?.person || '').trim(),
        })).filter((entry: any) => entry.person)
        : []

      if (!split.length) {
        return null
      }

      const receipt = payload?.receipt ? normalizeExtractedReceipt(payload.receipt) : null

      return {
        billDate: String(payload?.billDate || receipt?.billDate || '').trim(),
        billItems: Array.isArray(payload?.billItems)
          ? payload.billItems.map((item: any) => ({
            amountCents: Number(item?.amountCents || 0),
            assignedPeople: normalizePeople(item?.assignedPeople || []),
            name: String(item?.name || '').trim(),
          })).filter((item: any) => item.name)
          : [],
        createdAt: row.updated_at,
        groupId: String(payload?.groupId || '').trim(),
        groupName: '',
        merchant: String(receipt?.merchant || payload?.merchant || payload?.title || '').trim(),
        people: normalizePeople(
          Array.isArray(payload?.people) && payload.people.length
            ? payload.people
            : split.map((entry: any) => entry.person),
        ),
        source: 'saved_chat',
        sourceId: String(row.chat_id || '').trim(),
        split,
        title: String(payload?.title || receipt?.merchant || 'Untitled bill').trim() || 'Untitled bill',
        totalCents: Number(payload?.totalCents || receipt?.totalCents || 0),
      }
    })
    .filter(Boolean)
}

function scoreCandidate(context: any, candidate: any) {
  let score = 0
  const why = []
  const candidatePeople = normalizePeople(candidate.people || [])
  const candidatePeopleOverlap = candidatePeople.filter((person: string) =>
    context.peopleSet.has(normalizeName(person)),
  ).length
  const candidateMerchantTokens = tokenize(candidate.merchant || candidate.title || '')
  const candidateItemTokens = buildCandidateItemTokens(candidate)
  const merchantOverlap = countOverlap(context.merchantTokens, candidateMerchantTokens)
  const itemOverlap = countOverlap(context.receiptItemTokens, candidateItemTokens)
  const queryOverlap = countOverlap(context.queryTokens, unique([
    ...candidateMerchantTokens,
    ...candidateItemTokens,
    ...candidatePeople.map(normalizeName),
  ]))

  if (context.groupId && candidate.groupId === context.groupId) {
    score += 140
    why.push('same group')
  }

  if (candidatePeopleOverlap) {
    score += candidatePeopleOverlap * 18
    why.push(candidatePeopleOverlap === context.people.length && context.people.length
      ? 'same people'
      : 'people overlap')
  }

  if (itemOverlap) {
    score += Math.min(90, itemOverlap * 14)
    why.push('similar dishes')
  }

  if (queryOverlap) {
    score += Math.min(60, queryOverlap * 12)
    why.push('query match')
  }

  if (merchantOverlap) {
    score += merchantOverlap * 16
    why.push('merchant match')
  }

  if (context.totalCents > 0 && candidate.totalCents > 0) {
    const difference = Math.abs(candidate.totalCents - context.totalCents)
    const ratio = difference / Math.max(context.totalCents, 1)

    if (ratio <= 0.05) {
      score += 20
      why.push('similar total')
    } else if (ratio <= 0.15) {
      score += 10
      why.push('close total')
    }
  }

  const createdAt = candidate.createdAt ? new Date(candidate.createdAt) : null

  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

    if (ageDays <= 30) {
      score += 12
      why.push('recent')
    } else if (ageDays <= 90) {
      score += 8
      why.push('fairly recent')
    }
  }

  if (candidate.source === 'ledger_bill') {
    score += 6
  }

  return {
    score,
    why: unique(why).slice(0, 3),
  }
}

export function rankPreviousSplitCandidates(candidates: any[], input: any) {
  const context = buildSearchContext(input)

  if (!context.groupId) {
    return []
  }

  return candidates
    .map((candidate: any) => {
      const ranked = scoreCandidate(context, candidate)

      return {
        ...candidate,
        score: ranked.score,
        why: ranked.why,
      }
    })
    .filter((candidate: any) => candidate.score > 0)
    .sort((left: any, right: any) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return String(right.createdAt || '').localeCompare(String(left.createdAt || ''))
    })
    .slice(0, context.candidateLimit)
}

export async function searchPreviousSplits({
  chatId,
  groupId,
  maxResults,
  people,
  personId,
  query,
  receipt,
}: {
  chatId?: string
  groupId?: string
  maxResults?: number
  people?: string[]
  personId: string
  query?: string
  receipt: any
}) {
  const normalizedGroupId = String(groupId || '').trim()

  if (!normalizedGroupId) {
    return {
      matches: [],
      summary: 'Select the group before searching previous splits.',
    }
  }

  const ledger = await getLedgerSnapshot(personId)
  const groupNameById = new Map((ledger?.groups || []).map((group: any) => [String(group.id || '').trim(), String(group.name || '').trim()]))
  const chatCandidates = await loadSavedChatCandidates(personId, chatId)
  const candidates = [
    ...buildLedgerCandidates(ledger),
    ...chatCandidates.map((candidate: any) => ({
      ...candidate,
      groupName: candidate.groupName || groupNameById.get(candidate.groupId) || '',
    })),
  ]
  const matches = rankPreviousSplitCandidates(candidates, {
    groupId: normalizedGroupId,
    maxResults,
    people,
    query,
    receipt,
  })

  return {
    matches: matches.map((candidate: any) => ({
      billDate: candidate.billDate,
      billItems: candidate.billItems,
      groupId: candidate.groupId || undefined,
      groupName: candidate.groupName || undefined,
      merchant: candidate.merchant,
      people: candidate.people,
      source: candidate.source,
      sourceId: candidate.sourceId,
      split: candidate.split,
      title: candidate.title,
      totalCents: candidate.totalCents,
      why: candidate.why,
    })),
    summary: matches.length
      ? `Found ${matches.length} previous split${matches.length === 1 ? '' : 's'} that may help with this receipt.`
      : 'No relevant previous splits found.',
  }
}
