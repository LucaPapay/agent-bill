import { describe, expect, it } from 'vitest'
import { buildBillLedger } from './group-ledger'

describe('buildBillLedger', () => {
  it('splits assigned items and tip across the participating members', () => {
    expect(buildBillLedger({
      billItems: [
        {
          amountCents: 900,
          assignedPersonIds: ['bob'],
          name: 'Burger',
        },
        {
          amountCents: 300,
          assignedPersonIds: ['alice', 'cara'],
          name: 'Fries',
        },
      ],
      groupMemberIds: ['alice', 'bob', 'cara'],
      paidByPersonId: 'alice',
      tipAmountCents: 120,
      totalAmountCents: 1320,
    })).toEqual({
      memberShares: [
        {
          itemAmountCents: 150,
          personId: 'alice',
          tipAmountCents: 40,
          totalAmountCents: 190,
        },
        {
          itemAmountCents: 900,
          personId: 'bob',
          tipAmountCents: 40,
          totalAmountCents: 940,
        },
        {
          itemAmountCents: 150,
          personId: 'cara',
          tipAmountCents: 40,
          totalAmountCents: 190,
        },
      ],
      transfers: [
        {
          amountCents: 940,
          fromPersonId: 'bob',
          toPersonId: 'alice',
        },
        {
          amountCents: 190,
          fromPersonId: 'cara',
          toPersonId: 'alice',
        },
      ],
    })
  })

  it('falls back to an even full-group split when there are no items', () => {
    expect(buildBillLedger({
      billItems: [],
      groupMemberIds: ['alice', 'bob', 'cara'],
      paidByPersonId: 'alice',
      tipAmountCents: 90,
      totalAmountCents: 990,
    })).toEqual({
      memberShares: [
        {
          itemAmountCents: 300,
          personId: 'alice',
          tipAmountCents: 30,
          totalAmountCents: 330,
        },
        {
          itemAmountCents: 300,
          personId: 'bob',
          tipAmountCents: 30,
          totalAmountCents: 330,
        },
        {
          itemAmountCents: 300,
          personId: 'cara',
          tipAmountCents: 30,
          totalAmountCents: 330,
        },
      ],
      transfers: [
        {
          amountCents: 330,
          fromPersonId: 'bob',
          toPersonId: 'alice',
        },
        {
          amountCents: 330,
          fromPersonId: 'cara',
          toPersonId: 'alice',
        },
      ],
    })
  })

  it('rejects assignments to people outside the selected group', () => {
    expect(() => buildBillLedger({
      billItems: [
        {
          amountCents: 500,
          assignedPersonIds: ['drew'],
          name: 'Soup',
        },
      ],
      groupMemberIds: ['alice', 'bob'],
      paidByPersonId: 'alice',
      tipAmountCents: 0,
      totalAmountCents: 500,
    })).toThrowError('"Soup" is assigned to someone outside the selected group.')
  })
})
