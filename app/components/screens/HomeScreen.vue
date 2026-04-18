<script setup>
import ActivityRow from '../app/ActivityRow.vue'
import IconGlyph from '../app/IconGlyph.vue'

const emit = defineEmits(['nav', 'open-bill'])

const activities = [
  {
    emoji: '🍷',
    title: "Tuca's Tapas",
    sub: 'Sarah, Miles, Priya · 4 items',
    amount: '+$38.20',
    owed: true,
    accent: 'var(--mint)',
    action: 'open',
  },
  {
    emoji: '🛒',
    title: "Trader J's haul",
    sub: 'Weekly groceries · Miles',
    amount: '+$52.80',
    owed: true,
    accent: 'var(--marigold)',
  },
  {
    emoji: '✈️',
    title: 'Lisbon trip',
    sub: '12 bills · still settling',
    amount: '+$218.40',
    owed: true,
    accent: 'var(--lilac)',
  },
  {
    emoji: '🎬',
    title: 'Movie + popcorn',
    sub: 'You paid Jordan back',
    amount: '-$14.50',
    accent: 'var(--sky)',
  },
]
</script>

<template>
  <div class="screen">
    <div class="section-pad" style="padding-top: 8px; padding-bottom: 28px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="mono" style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);">
            Sat · Apr 18
          </div>
          <h1 class="h-display" style="font-size: 40px; line-height: 1.1; margin: 6px 0 0;">
            Hi, Jojo.
          </h1>
        </div>

        <button style="position: relative; padding: 8px;">
          <IconGlyph name="bell" width="22" height="22" />
          <div style="position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 4px; background: var(--tomato);" />
        </button>
      </div>
    </div>

    <div class="section-pad">
      <div style="background: var(--ink); color: var(--cream); border-radius: 24px; padding: 22px 20px; position: relative; overflow: visible;">
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6;">
          You are owed
        </div>
        <div class="h-display" style="font-size: 60px; line-height: 1; margin-top: 6px; letter-spacing: -0.02em;">
          $142.58
        </div>
        <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;">
          <div class="chip" style="background: var(--tomato);">
            3 pending splits
          </div>
          <div class="chip" style="background: rgba(255,255,255,0.12);">
            +$48 this week
          </div>
        </div>
        <div style="position: absolute; right: 8px; top: -10px; transform: rotate(6deg); background: var(--marigold); color: var(--ink); padding: 4px 14px; font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; box-shadow: 1px 1px 0 rgba(0,0,0,0.15);">
          APR · BALANCE
        </div>
      </div>
    </div>

    <div class="section-pad" style="margin-top: 20px;">
      <div style="background: var(--paper); border-radius: 20px; padding: 14px; border: 1.5px solid var(--ink); display: flex; gap: 12px; align-items: flex-start;">
        <div style="width: 36px; height: 36px; border-radius: 12px; background: var(--ink); display: flex; align-items: center; justify-content: center; color: var(--marigold); flex-shrink: 0;">
          <IconGlyph name="sparkle" width="20" height="20" />
        </div>

        <div style="flex: 1;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);">
            Penny · your split assistant
          </div>
          <div style="font-size: 14px; line-height: 1.35; margin-top: 4px;">
            I noticed a receipt design for <b>Tuca's Tapas</b>. Want me to walk you through a clean split flow?
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button class="btn btn-accent" style="padding: 8px 14px; font-size: 13px;" @click="emit('nav', 'scan')">
              Yes, scan it
            </button>
            <button class="btn btn-ghost" style="padding: 8px 14px; font-size: 13px;">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="section-pad" style="margin-top: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
        <h3 class="h-ui" style="font-size: 16px; margin: 0;">
          Recent activity
        </h3>
        <span class="mono" style="font-size: 11px; color: var(--muted);">
          see all
        </span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <ActivityRow
          v-for="activity in activities"
          :key="activity.title"
          :emoji="activity.emoji"
          :title="activity.title"
          :sub="activity.sub"
          :amount="activity.amount"
          :accent="activity.accent"
          :owed="activity.owed"
          @select="activity.action === 'open' ? emit('open-bill') : null"
        />
      </div>
    </div>
  </div>
</template>
