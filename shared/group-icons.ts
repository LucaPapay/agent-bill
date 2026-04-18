export const groupIconOptions = [
  '🍽️',
  '🏠',
  '✈️',
  '🏔️',
  '🥾',
  '🍷',
  '🎉',
  '🧾',
]

export const defaultGroupIcon = groupIconOptions[0] || '🍽️'

export function getGroupIconLabel(group: { icon?: null | string, name?: null | string }) {
  const icon = String(group?.icon || '').trim()

  if (icon) {
    return icon
  }

  const name = String(group?.name || '').trim()

  if (name) {
    return name.charAt(0).toUpperCase()
  }

  return '?'
}
