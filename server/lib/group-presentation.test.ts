import { describe, expect, it } from 'vitest'
import {
  getGroupIconBackground,
  getGroupIconLabel,
  groupBackgroundColorOptions,
} from '../../shared/group-icons'

describe('group presentation helpers', () => {
  it('picks a home icon for obvious house groups', () => {
    expect(getGroupIconLabel({ name: 'Studio House League' })).toBe('🏠')
  })

  it('picks a mountain icon for alpine groups', () => {
    expect(getGroupIconLabel({ name: 'Alpine Escape 2026' })).toBe('🏔️')
  })

  it('keeps stored background colors and otherwise falls back to a known palette value', () => {
    expect(getGroupIconBackground({
      backgroundColor: '#A9D4F2',
      name: 'Anything',
    })).toBe('#A9D4F2')

    expect(groupBackgroundColorOptions).toContain(
      getGroupIconBackground({ name: 'Flat dinner club' }),
    )
  })
})
