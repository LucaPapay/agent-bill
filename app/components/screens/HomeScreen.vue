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
              Split bills without the spreadsheet energy.
            </h1>
            <p style="max-width: 38rem; margin: 18px 0 0; font-size: 16px; line-height: 1.6; color: var(--muted);">
              Scan a receipt, sort out who owes what, and keep every item, share, and transfer in one local ledger your group can trust.
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
            {{ summary.netBalanceTitle }}
          </div>

          <div
            class="h-display"
            style="font-size: clamp(56px, 8vw, 86px); line-height: 1; margin-top: 10px; letter-spacing: -0.03em;"
            :style="{
              color: summary.netBalanceTone === 'tomato'
                ? 'var(--tomato)'
                : summary.netBalanceTone === 'mint'
                  ? 'var(--cream)'
                  : 'var(--cream)',
            }"
          >
            {{ summary.netBalanceLabel }}
          </div>

          <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;">
            <button class="chip chip-action" type="button" style="background: var(--tomato);" @click="emit('nav', 'groups')">
              You owe {{ summary.youOweLabel }}
            </button>
            <button class="chip chip-action" type="button" style="background: rgba(104, 217, 151, 0.2); color: var(--mint);" @click="emit('nav', 'groups')">
              Owed to you {{ summary.owedToYouLabel }}
            </button>
            <button class="chip chip-action" type="button" style="background: rgba(255,255,255,0.12);" @click="emit('nav', 'bills')">
              {{ summary.yourOpenGroupsCount }} active groups
            </button>
          </div>

          <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap;">
              <div class="mono" style="font-size: 11px; color: rgba(255,255,255,0.58); text-transform: uppercase; letter-spacing: 0.1em;">
                By group
              </div>
              <button class="mono" type="button" style="font-size: 11px; color: rgba(255,255,255,0.58);" @click="emit('nav', 'groups')">
                {{ summary.groupsCount }} groups in ledger
              </button>
            </div>

            <div v-if="summary.groupBalances.length" style="display: grid; gap: 8px; margin-top: 12px;">
              <div
                v-for="group in summary.groupBalances"
                :key="group.groupId"
                style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 16px; background: rgba(255,255,255,0.06);"
              >
                <div>
                  <div style="font-weight: 700; font-size: 14px;">
                    {{ group.groupName }}
                  </div>
                  <div class="mono" style="font-size: 11px; color: rgba(255,255,255,0.58); margin-top: 4px;">
                    {{ group.helperLabel }}
                  </div>
                </div>

                <div style="text-align: right;">
                  <div class="mono" style="font-size: 11px; color: rgba(255,255,255,0.58);">
                    {{ group.directionLabel }}
                  </div>
                  <div
                    style="font-size: 14px; font-weight: 700; margin-top: 4px;"
                    :style="{
                      color: group.tone === 'tomato'
                        ? 'var(--tomato)'
                        : group.tone === 'mint'
                          ? 'var(--mint)'
                          : 'rgba(255,255,255,0.72)',
                    }"
                  >
                    {{ group.amountLabel }}
                  </div>
                </div>
              </div>
            </div>

            <div v-else style="margin-top: 12px; padding: 10px 12px; border-radius: 16px; background: rgba(255,255,255,0.06); font-size: 13px;">
              Start a group to see what you owe and what is coming back to you.
            </div>
          </div>

          <div style="position: absolute; right: 8px; top: -10px; transform: rotate(6deg); background: var(--marigold); color: var(--ink); padding: 4px 14px; font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; box-shadow: 1px 1px 0 rgba(0,0,0,0.15);">
            YOUR · BALANCE
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
                Penny · quick start
              </div>
              <div style="font-size: 15px; line-height: 1.45; margin-top: 6px;">
                Start with a group, add an itemized bill, or jump straight into a receipt scan. Penny keeps the split fast and the ledger honest.
              </div>
              <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
                <button class="btn btn-accent" style="padding: 10px 16px; font-size: 13px;" @click="emit('nav', 'groups')">
                  Open groups
                </button>
                <button class="btn btn-ghost" style="padding: 10px 16px; font-size: 13px;" @click="emit('nav', 'scan')">
                  Scan a receipt
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
              Start in Groups to create a ledger group, then open a split chat from Scan or review saved ones in Splits.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
