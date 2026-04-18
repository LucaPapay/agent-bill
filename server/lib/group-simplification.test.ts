import { describe, expect, it } from 'vitest'
import { buildOpenGroupTransfers, simplifyGroupTransfers } from './group-simplification'

describe('simplifyGroupTransfers', () => {
  it('collapses intermediate hops into direct transfers', () => {
    expect(simplifyGroupTransfers([
      { amountCents: 1200, fromPersonId: 'alice', toPersonId: 'bob' },
      { amountCents: 1200, fromPersonId: 'bob', toPersonId: 'cara' },
    ])).toEqual([
      { amountCents: 1200, fromPersonId: 'alice', toPersonId: 'cara' },
    ])
  })

  it('nets multiple debts and credits into the smallest open set', () => {
    expect(simplifyGroupTransfers([
      { amountCents: 1500, fromPersonId: 'alice', toPersonId: 'cara' },
      { amountCents: 500, fromPersonId: 'bob', toPersonId: 'cara' },
      { amountCents: 2000, fromPersonId: 'cara', toPersonId: 'drew' },
    ])).toEqual([
      { amountCents: 1500, fromPersonId: 'alice', toPersonId: 'drew' },
      { amountCents: 500, fromPersonId: 'bob', toPersonId: 'drew' },
    ])
  })

  it('ignores zero, negative, and self-transfers', () => {
    expect(simplifyGroupTransfers([
      { amountCents: 0, fromPersonId: 'alice', toPersonId: 'bob' },
      { amountCents: -500, fromPersonId: 'alice', toPersonId: 'cara' },
      { amountCents: 900, fromPersonId: 'bob', toPersonId: 'bob' },
      { amountCents: 700, fromPersonId: 'alice', toPersonId: 'cara' },
    ])).toEqual([
      { amountCents: 700, fromPersonId: 'alice', toPersonId: 'cara' },
    ])
  })
})

describe('buildOpenGroupTransfers', () => {
  it('subtracts active settlement payments from open balances', () => {
    expect(buildOpenGroupTransfers(
      [
        { amountCents: 1000, fromPersonId: 'alice', toPersonId: 'bob' },
        { amountCents: 600, fromPersonId: 'cara', toPersonId: 'bob' },
      ],
      [
        { amountCents: 300, fromPersonId: 'alice', toPersonId: 'bob' },
        { amountCents: 200, fromPersonId: 'cara', toPersonId: 'bob', voidedAt: '2026-04-18T12:00:00.000Z' },
      ],
    )).toEqual([
      { amountCents: 700, fromPersonId: 'alice', toPersonId: 'bob' },
      { amountCents: 600, fromPersonId: 'cara', toPersonId: 'bob' },
    ])
  })
})
