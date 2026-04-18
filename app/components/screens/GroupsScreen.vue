<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'
import IconGlyph from '../app/IconGlyph.vue'

const groups = [
  { name: 'Lisbon 2026', emoji: '🇵🇹', members: ['You', 'Sarah', 'Miles', 'Priya'], balance: '+$218.40', bills: 12, accent: 'var(--lilac)' },
  { name: 'The Roommates', emoji: '🏠', members: ['You', 'Jordan', 'Kai'], balance: '-$34.20', bills: 47, accent: 'var(--sky)' },
  { name: 'Supper club', emoji: '🍷', members: ['You', 'Sarah', 'Miles', 'Priya', 'Alex'], balance: '+$12.10', bills: 8, accent: 'var(--tomato)' },
  { name: 'Weekend hikes', emoji: '🥾', members: ['You', 'Miles'], balance: 'Even', bills: 3, accent: 'var(--mint)' },
]
</script>

<template>
  <div class="screen">
    <div class="section-pad" style="padding-top: 8px; padding-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1 class="h-display" style="font-size: 42px; line-height: 1; margin: 0;">
          Groups
        </h1>

        <button style="width: 40px; height: 40px; border-radius: 14px; background: var(--ink); color: var(--cream); display: flex; align-items: center; justify-content: center;">
          <IconGlyph name="plus" width="20" height="20" />
        </button>
      </div>

      <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 6px;">
        4 ACTIVE · 2 PENDING INVITES
      </div>
    </div>

    <div class="section-pad groups-grid">
      <div
        v-for="group in groups"
        :key="group.name"
        class="surface-panel"
        style="padding: 16px 18px;"
      >
        <div style="display: flex; align-items: center; gap: 12px;">
          <div
            :style="{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: group.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              border: '1.5px solid var(--ink)',
            }"
          >
            {{ group.emoji }}
          </div>

          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; font-size: 17px;">
              {{ group.name }}
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
              {{ group.bills }} bills · {{ group.members.length }} people
            </div>
          </div>

          <div class="mono" style="font-weight: 700; font-size: 15px;">
            {{ group.balance }}
          </div>
        </div>

        <div style="display: flex; margin-top: 16px; padding-left: 4px;">
          <div
            v-for="(member, index) in group.members.slice(0, 4)"
            :key="member"
            :style="{ marginLeft: index === 0 ? 0 : '-10px' }"
          >
            <AvatarBadge :name="member" size="sm" />
          </div>

          <div
            v-if="group.members.length > 4"
            class="avatar sm"
            style="margin-left: -10px; background: var(--cream-2);"
          >
            +{{ group.members.length - 4 }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
