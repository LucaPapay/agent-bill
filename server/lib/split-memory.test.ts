import { describe, expect, it } from 'vitest'
import { rankPreviousSplitCandidates } from './split-memory'

describe('rankPreviousSplitCandidates', () => {
  it('prefers same-group candidates with similar people and dishes', () => {
    const matches = rankPreviousSplitCandidates([
      {
        billDate: '2026-04-10',
        billItems: [
          { amountCents: 1800, assignedPeople: ['Jojo', 'Luca'], name: 'Sushi platter' },
          { amountCents: 600, assignedPeople: ['Jojo'], name: 'Cola' },
        ],
        createdAt: '2026-04-10T18:00:00.000Z',
        groupId: 'group-1',
        groupName: 'Tokyo Crew',
        merchant: 'Hitomi Sushi',
        people: ['Jojo', 'Luca'],
        source: 'ledger_bill',
        sourceId: 'bill-1',
        split: [],
        title: 'Hitomi dinner',
        totalCents: 2640,
      },
      {
        billDate: '2026-04-11',
        billItems: [
          { amountCents: 2200, assignedPeople: ['Jojo', 'Sarah'], name: 'Burgers' },
        ],
        createdAt: '2026-04-11T18:00:00.000Z',
        groupId: 'group-2',
        groupName: 'Burger Crew',
        merchant: 'Burger Place',
        people: ['Jojo', 'Sarah'],
        source: 'saved_chat',
        sourceId: 'chat-2',
        split: [],
        title: 'Burger night',
        totalCents: 2200,
      },
    ], {
      groupId: 'group-1',
      people: ['Jojo', 'Luca'],
      receipt: {
        currency: 'EUR',
        items: [
          { amountCents: 1800, name: 'Sushi platter', quantity: 1 },
          { amountCents: 600, name: 'Cola', quantity: 1 },
        ],
        merchant: 'Hitomi Sushi',
        subtotalCents: 2400,
        taxCents: 240,
        tipCents: 0,
        totalCents: 2640,
      },
    })

    expect(matches).toHaveLength(2)
    expect(matches[0]?.sourceId).toBe('bill-1')
    expect(matches[0]?.why).toContain('same group')
    expect(matches[0]?.why).toContain('same people')
    expect(matches[0]?.why).toContain('similar dishes')
  })

  it('returns no matches before the group is known', () => {
    const matches = rankPreviousSplitCandidates([
      {
        billDate: '2026-04-10',
        billItems: [
          { amountCents: 1800, assignedPeople: ['Jojo', 'Luca'], name: 'Sushi platter' },
        ],
        createdAt: '2026-04-10T18:00:00.000Z',
        groupId: 'group-1',
        groupName: 'Tokyo Crew',
        merchant: 'Hitomi Sushi',
        people: ['Jojo', 'Luca'],
        source: 'ledger_bill',
        sourceId: 'bill-1',
        split: [],
        title: 'Hitomi dinner',
        totalCents: 2640,
      },
    ], {
      groupId: '',
      people: ['Jojo', 'Luca'],
      receipt: {
        currency: 'EUR',
        items: [
          { amountCents: 1800, name: 'Sushi platter', quantity: 1 },
        ],
        merchant: 'Hitomi Sushi',
        subtotalCents: 1800,
        taxCents: 0,
        tipCents: 0,
        totalCents: 1800,
      },
    })

    expect(matches).toEqual([])
  })
})
