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
    <div class="section-pad pb-7 pt-6">
      <div class="home-hero">
        <div class="flex items-start justify-between gap-5">
          <div>
            <div class="section-label-tight">
              {{ summary.dateLabel }}
            </div>
            <h1 class="h-display mt-2.5 max-w-[8ch] text-[clamp(40px,6vw,68px)] leading-[0.95]">
              Split bills without the spreadsheet energy.
            </h1>
            <p class="mt-[18px] max-w-[38rem] text-base leading-[1.6] text-muted">
              Scan a receipt, sort out who owes what, and keep every item, share, and transfer in one local ledger your group can trust.
            </p>
          </div>

          <button class="relative shrink-0 p-2" @click="emit('nav', 'profile')">
            <IconGlyph name="bell" width="22" height="22" />
            <div
              class="absolute right-[6px] top-[6px] h-2 w-2 rounded-[4px]"
              :class="health?.databaseConfigured ? 'bg-mint' : 'bg-tomato'"
            />
          </button>
        </div>

        <div class="relative min-h-full overflow-visible rounded-[28px] bg-ink px-[22px] py-6 text-cream">
          <div class="text-xs font-semibold uppercase tracking-[0.1em] opacity-60">
            {{ summary.netBalanceTitle }}
          </div>

          <div
            class="h-display"
            :class="[
              'mt-2.5 text-[clamp(56px,8vw,86px)] leading-none tracking-[-0.03em]',
              summary.netBalanceTone === 'tomato' ? 'text-tomato' : 'text-cream',
            ]"
          >
            {{ summary.netBalanceLabel }}
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
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

          <div class="mt-[18px] border-t border-white/10 pt-[14px]">
            <div class="flex flex-wrap items-baseline justify-between gap-3">
              <div class="mono text-[11px] uppercase tracking-[0.1em] text-white/[0.58]">
                By group
              </div>
              <button class="mono text-[11px] text-white/[0.58]" type="button" @click="emit('nav', 'groups')">
                {{ summary.groupsCount }} groups in ledger
              </button>
            </div>

            <div v-if="summary.groupBalances.length" class="mt-3 grid gap-2">
              <div
                v-for="group in summary.groupBalances"
                :key="group.groupId"
                class="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5"
              >
                <div>
                  <div class="text-sm font-bold">
                    {{ group.groupName }}
                  </div>
                  <div class="mono mt-1 text-[11px] text-white/[0.58]">
                    {{ group.helperLabel }}
                  </div>
                </div>

                <div class="text-right">
                  <div class="mono text-[11px] text-white/[0.58]">
                    {{ group.directionLabel }}
                  </div>
                  <div
                    :class="[
                      'mt-1 text-sm font-bold',
                      group.tone === 'tomato'
                        ? 'text-tomato'
                        : group.tone === 'mint'
                          ? 'text-mint'
                          : 'text-white/[0.72]',
                    ]"
                  >
                    {{ group.amountLabel }}
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="mt-3 rounded-2xl bg-white/[0.06] px-3 py-2.5 text-[13px]">
              Start a group to see what you owe and what is coming back to you.
            </div>
          </div>

          <div class="absolute right-2 top-[-10px] rotate-[6deg] bg-marigold px-[14px] py-1 font-mono text-[10px] font-bold tracking-[0.1em] text-ink shadow-[1px_1px_0_rgba(0,0,0,0.15)]">
            YOUR · BALANCE
          </div>
        </div>
      </div>
    </div>

    <div class="section-pad mt-1.5">
      <div class="home-main">
        <div class="surface-panel p-[18px]">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-ink text-marigold">
              <IconGlyph name="sparkle" width="20" height="20" />
            </div>

            <div class="flex-1">
              <div class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                Penny · quick start
              </div>
              <div class="mt-1.5 text-[15px] leading-[1.45]">
                Start with a group, add an itemized bill, or jump straight into a receipt scan. Penny keeps the split fast and the ledger honest.
              </div>
              <div class="mt-[14px] flex flex-wrap gap-2">
                <button class="btn btn-accent btn-sm" @click="emit('nav', 'groups')">
                  Open groups
                </button>
                <button class="btn btn-ghost btn-sm" @click="emit('nav', 'scan')">
                  Scan a receipt
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="mb-2.5 flex items-baseline justify-between">
            <h3 class="h-ui m-0 text-lg">
              Recent bills
            </h3>
            <span class="mono text-[11px] text-muted">
              {{ summary.peopleCount }} people in ledger
            </span>
          </div>

          <div v-if="recentBills.length" class="flex flex-col gap-2.5">
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

          <div v-else class="surface-panel p-[18px]">
            <div class="section-label-tight">
              No saved bills yet
            </div>
            <div class="mt-2 text-sm leading-[1.5]">
              Start in Groups to create a ledger group, then open a split chat from Scan or review saved ones in Splits.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
