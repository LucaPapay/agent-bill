<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'
import IconGlyph from '../app/IconGlyph.vue'

const props = defineProps({
  currentUser: {
    type: Object,
    default: null,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  health: {
    type: Object,
    default: null,
  },
  ledger: {
    type: Object,
    required: true,
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['add-to-all-groups', 'logout'])

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
      <div class="surface-panel" style="padding: 20px;">
        <div style="display: flex; gap: 14px; align-items: center;">
          <AvatarBadge :name="currentUser?.name || 'You'" size="lg" />
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 18px;">
              {{ currentUser?.name || 'Signed in' }}
            </div>
            <div style="font-size: 12px; color: var(--muted);">
              {{ currentUser?.email || 'Google account' }}
            </div>
          </div>
          <button class="btn btn-ghost" style="padding: 10px 14px; font-size: 12px;" @click="emit('logout')">
            Log out
          </button>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap;">
          <button
            class="btn btn-accent"
            :disabled="saving"
            style="padding: 10px 16px; font-size: 12px;"
            @click="emit('add-to-all-groups')"
          >
            {{ saving ? 'Adding you...' : 'Add me to all groups' }}
          </button>

          <div class="mono" style="align-self: center; font-size: 10px; letter-spacing: 0.12em; color: var(--muted); text-transform: uppercase;">
            Testing only
          </div>
        </div>

        <div v-if="errorMessage" style="margin-top: 12px; padding: 12px 14px; border-radius: 16px; background: #fff0ec; color: #7d2f21; border: 1px solid rgba(255,84,54,0.2); font-size: 13px;">
          {{ errorMessage }}
        </div>
      </div>

      <div>
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
                Your bill-splitting copilot
              </div>
            </div>

            <div class="chip" :style="{ background: health?.piReady ? 'var(--mint)' : 'rgba(255,255,255,0.12)', color: health?.piReady ? 'var(--ink)' : 'var(--cream)' }">
              {{ health?.piReady ? 'on' : 'off' }}
            </div>
          </div>

          <div style="font-size: 13px; margin-top: 14px; opacity: 0.85; line-height: 1.4;">
            She reads receipts, suggests who owes what, and turns messy group tabs into a split you can actually settle.
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
        </div>
      </div>
    </div>

    <div class="section-pad" style="margin-top: 22px; text-align: center;">
      <div class="mono" style="font-size: 10px; color: var(--muted); letter-spacing: 0.15em;">
        KEEP THE TAB FAIR · KEEP THE LEDGER CLEAN
      </div>
    </div>
  </div>
</template>
