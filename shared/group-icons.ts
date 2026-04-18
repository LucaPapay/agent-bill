export const groupIconOptions = [
  '🍽️',
  '🏠',
  '✈️',
  '🏔️',
  '🥾',
  '🍷',
  '🎉',
  '🧾',
] as const

export const groupBackgroundColorOptions = [
  '#F6C453',
  '#F4D58D',
  '#F5B4A7',
  '#D7C0F1',
  '#A9D4F2',
  '#B9E3C6',
  '#F1C48A',
  '#F7C7D9',
] as const

export const defaultGroupIcon = groupIconOptions[0]
export const defaultGroupBackgroundColor = groupBackgroundColorOptions[0]

const keywordIconRules = [
  { icon: '🏠', keywords: ['flat', 'house', 'home', 'apartment', 'room', 'roommate', 'studio', 'household'] },
  { icon: '✈️', keywords: ['trip', 'travel', 'flight', 'vacation', 'holiday', 'airport', 'journey'] },
  { icon: '🏔️', keywords: ['alpine', 'mountain', 'ski', 'snow', 'cabin', 'escape', 'hike', 'trail', 'camp'] },
  { icon: '🥾', keywords: ['walk', 'hiking', 'trek', 'run', 'boot'] },
  { icon: '🍷', keywords: ['wine', 'supper', 'cocktail', 'bar', 'drinks'] },
  { icon: '🎉', keywords: ['party', 'birthday', 'celebration', 'festival', 'league', 'crew'] },
  { icon: '🧾', keywords: ['rent', 'utilities', 'bills', 'receipt', 'expenses', 'budget'] },
  { icon: '🍽️', keywords: ['dinner', 'lunch', 'brunch', 'breakfast', 'food', 'meal', 'restaurant'] },
] as const

function hashText(value: string) {
  let hash = 0

  for (const char of value) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0)
    hash |= 0
  }

  return Math.abs(hash)
}

function hasKnownBackgroundColor(value: string) {
  return groupBackgroundColorOptions.includes(value as typeof groupBackgroundColorOptions[number])
}

export function pickSuggestedGroupIcon(name?: null | string): string {
  const normalizedName = String(name || '').trim().toLowerCase()

  for (const rule of keywordIconRules) {
    if (rule.keywords.some(keyword => normalizedName.includes(keyword))) {
      return rule.icon
    }
  }

  if (!normalizedName) {
    return defaultGroupIcon
  }

  return groupIconOptions[hashText(normalizedName) % groupIconOptions.length] || defaultGroupIcon
}

export function pickSuggestedGroupBackgroundColor(name?: null | string, icon?: null | string): string {
  const seed = `${String(name || '').trim().toLowerCase()}:${String(icon || '').trim()}`

  if (!seed.replace(':', '')) {
    return defaultGroupBackgroundColor
  }

  return groupBackgroundColorOptions[hashText(seed) % groupBackgroundColorOptions.length] || defaultGroupBackgroundColor
}

export function getGroupIconLabel(group: { icon?: null | string, name?: null | string }): string {
  const icon = String(group?.icon || '').trim()

  if (icon) {
    return icon
  }

  return pickSuggestedGroupIcon(group?.name)
}

export function getGroupIconBackground(group: {
  backgroundColor?: null | string
  icon?: null | string
  name?: null | string
}): string {
  const backgroundColor = String(group?.backgroundColor || '').trim()

  if (hasKnownBackgroundColor(backgroundColor)) {
    return backgroundColor
  }

  return pickSuggestedGroupBackgroundColor(group?.name, getGroupIconLabel(group))
}
