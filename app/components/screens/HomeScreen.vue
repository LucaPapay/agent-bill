<script setup>
import ActivityRow from '../app/ActivityRow.vue'
import IconGlyph from '../app/IconGlyph.vue'

defineProps({
  health: {
    type: Object,
    default: null,
  },
  recentBills: {
    type: Array,
    default: () => [],
  },
  summary: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['nav', 'open-bill'])
</script>

<template>
  <div class="screen">
    <div class="section-pad" style="padding-top: 24px; padding-bottom: 28px;">
      <div class="home-hero">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
          <div>
            <div class="mono" style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);">
              {{ summary.dateLabel }}
            </div>
            <h1 class="h-display" style="font-size: clamp(40px, 6vw, 68px); line-height: 0.95; margin: 10px 0 0; max-width: 8ch;">
              Split bills without losing the ledger.
            </h1>
            <p style="max-width: 38rem; margin: 18px 0 0; font-size: 16px; line-height: 1.6; color: var(--muted);">
              The app now keeps the design flow from home to scan to assignment, while the actual saved state still comes from local groups, bill items, shares, and transfers.
            </p>
          </div>

          <button style="position: relative; padding: 8px; flex-shrink: 0;" @click="emit('nav', 'profile')">
            <IconGlyph name="bell" width="22" height="22" />
            <div
              :style="{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '8px',
                height: '8px',
                borderRadius: '4px',
                background: health?.databaseConfigured ? 'var(--mint)' : 'var(--tomato)',
              }"
            />
          </button>
        </div>

        <div style="background: var(--ink); color: var(--cream); border-radius: 28px; padding: 24px 22px; position: relative; overflow: visible; min-height: 100%;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6;">
            Open settlement
          </div>
          <div class="h-display" style="font-size: clamp(56px, 8vw, 86px); line-height: 1; margin-top: 10px; letter-spacing: -0.03em;">
            {{ summary.openAmountLabel }}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;">
            <div class="chip" style="background: var(--tomato);">
              {{ summary.pendingPayments }} pending payments
            </div>
            <div class="chip" style="background: rgba(255,255,255,0.12);">
              {{ summary.groupsCount }} groups
            </div>
            <div class="chip" style="background: rgba(255,255,255,0.12);">
              {{ summary.totalBills }} saved bills
            </div>
          </div>
          <div style="position: absolute; right: 8px; top: -10px; transform: rotate(6deg); background: var(--marigold); color: var(--ink); padding: 4px 14px; font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; box-shadow: 1px 1px 0 rgba(0,0,0,0.15);">
            LOCAL · LEDGER
          </div>
        </div>
      </div>
    </div>

    <div class="section-pad" style="margin-top: 6px;">
      <div class="home-main">
        <div class="surface-panel" style="padding: 18px;">
          <div style="display: flex; gap: 12px; align-items: flex-start;">
            <div style="width: 40px; height: 40px; border-radius: 14px; background: var(--ink); display: flex; align-items: center; justify-content: center; color: var(--marigold); flex-shrink: 0;">
              <IconGlyph name="sparkle" width="20" height="20" />
            </div>

            <div style="flex: 1;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);">
                Penny · design shell
              </div>
              <div style="font-size: 15px; line-height: 1.45; margin-top: 6px;">
                Create people and groups first, then add an itemized bill or jump into the scan flow. The saved truth still lives in Postgres.
              </div>
              <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
                <button class="btn btn-accent" style="padding: 10px 16px; font-size: 13px;" @click="emit('nav', 'groups')">
                  Open groups
                </button>
                <button class="btn btn-ghost" style="padding: 10px 16px; font-size: 13px;" @click="emit('nav', 'scan')">
                  Try scan flow
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
            <h3 class="h-ui" style="font-size: 18px; margin: 0;">
              Recent bills
            </h3>
            <span class="mono" style="font-size: 11px; color: var(--muted);">
              {{ summary.peopleCount }} people in ledger
            </span>
          </div>

          <div v-if="recentBills.length" style="display: flex; flex-direction: column; gap: 10px;">
            <ActivityRow
              v-for="bill in recentBills"
              :key="bill.billId"
              :accent="bill.accent"
              :amount="bill.amount"
              :emoji="bill.emoji"
              :sub="bill.sub"
              :title="bill.title"
              owed
              @select="emit('open-bill', bill)"
            />
          </div>

          <div v-else class="surface-panel" style="padding: 18px;">
            <div class="mono" style="font-size: 11px; letter-spacing: 0.12em; color: var(--muted); text-transform: uppercase;">
              No saved bills yet
            </div>
            <div style="margin-top: 8px; font-size: 14px; line-height: 1.5;">
              Start in Groups to create a ledger group, then add your first bill in the Splits tab.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
