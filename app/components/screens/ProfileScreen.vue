<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'
import IconGlyph from '../app/IconGlyph.vue'

const props = defineProps({
  currentUser: {
    type: Object,
    default: null,
  },
  health: {
    type: Object,
    default: null,
  },
  ledger: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['logout'])

const savedBills = computed(() =>
  props.ledger.groups.reduce((sum, group) => sum + group.bills.length, 0)
)

const settings = computed(() => [
  ['People', `${props.ledger.people.length} saved`],
  ['Groups', `${props.ledger.groups.length} active`],
  ['Saved bills', `${savedBills.value} total`],
  ['Database', props.health?.databaseConfigured ? 'Ready' : 'Missing URL'],
  ['Pi analysis', props.health?.piReady ? 'Available' : 'Disabled'],
])
</script>

<template>
  <div class="screen">
    <div class="section-pad" style="padding-top: 8px; padding-bottom: 20px;">
      <h1 class="h-display" style="font-size: 42px; line-height: 1; margin: 0;">
        You
      </h1>
    </div>

    <div class="section-pad profile-grid">
      <div class="surface-panel" style="padding: 20px; display: flex; gap: 14px; align-items: center;">
        <AvatarBadge :name="currentUser?.name || 'You'" size="lg" />
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 18px;">
            {{ currentUser?.name || 'Signed in' }}
          </div>
          <div style="font-size: 12px; color: var(--muted);">
            {{ currentUser?.email || 'Google account' }}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
            <span class="chip chip-muted">Postgres-backed</span>
            <span class="chip chip-muted">Google session</span>
          </div>
        </div>
        <button class="btn btn-ghost" style="padding: 10px 14px; font-size: 12px;" @click="emit('logout')">
          Log out
        </button>
      </div>

      <div>
        <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">
          Your assistant
        </div>

        <div style="background: var(--ink); color: var(--cream); border-radius: 22px; padding: 18px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 14px; background: var(--marigold); color: var(--ink); display: flex; align-items: center; justify-content: center;">
              <IconGlyph name="sparkle" width="24" height="24" />
            </div>

            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 16px;">
                Penny
              </div>
              <div style="font-size: 12px; opacity: 0.7;">
                Split assistant · local-first tone
              </div>
            </div>

            <div class="chip" :style="{ background: health?.piReady ? 'var(--mint)' : 'rgba(255,255,255,0.12)', color: health?.piReady ? 'var(--ink)' : 'var(--cream)' }">
              {{ health?.piReady ? 'on' : 'off' }}
            </div>
          </div>

          <div style="font-size: 13px; margin-top: 14px; opacity: 0.85; line-height: 1.4;">
            Penny can analyze bills when `OPENAI_API_KEY` exists, but the manual ledger stays available even when AI is off.
          </div>
        </div>
      </div>
    </div>

    <div class="section-pad" style="margin-top: 16px;">
      <div class="surface-panel" style="overflow: hidden;">
        <div
          v-for="([label, detail], index) in settings"
          :key="label"
          :style="{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: index < settings.length - 1 ? '1px solid rgba(20,18,16,0.08)' : 'none',
          }"
        >
          <div style="flex: 1; font-size: 15px; font-weight: 500;">
            {{ label }}
          </div>
          <span v-if="detail" class="mono" style="font-size: 12px; color: var(--muted); margin-right: 8px;">
            {{ detail }}
          </span>
          <IconGlyph name="chevron" width="16" height="16" style="color: var(--muted);" />
        </div>
      </div>
    </div>

    <div class="section-pad" style="margin-top: 22px; text-align: center;">
      <div class="mono" style="font-size: 10px; color: var(--muted); letter-spacing: 0.15em;">
        AGENT-BILL · MERGED APP SHELL
      </div>
    </div>
  </div>
</template>
