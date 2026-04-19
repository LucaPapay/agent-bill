<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'
import IconGlyph from '../app/IconGlyph.vue'
import CreatePersonForm from '../ledger/CreatePersonForm.vue'

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
  personName: {
    type: String,
    default: '',
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'add-to-all-groups',
  'logout',
  'submit-person',
  'update:person-name',
])

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
    <div class="section-pad pb-5 pt-2">
      <h1 class="h-display m-0 text-[42px] leading-none">
        You
      </h1>
    </div>

    <div class="section-pad profile-grid">
      <div class="surface-panel p-5">
        <div class="flex items-center gap-[14px]">
          <AvatarBadge :name="currentUser?.name || 'You'" size="lg" />
          <div class="flex-1">
            <div class="text-lg font-bold">
              {{ currentUser?.name || 'Signed in' }}
            </div>
            <div class="text-xs text-muted">
              {{ currentUser?.email || 'Google account' }}
            </div>
          </div>
          <button class="btn btn-ghost px-[14px] py-2.5 text-xs" @click="emit('logout')">
            Log out
          </button>
        </div>

        <div v-if="errorMessage" class="callout-error mt-3">
          {{ errorMessage }}
        </div>
      </div>

      <div>
        <div class="rounded-[22px] bg-ink p-[18px] text-cream">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-[14px] bg-marigold text-ink">
              <IconGlyph name="sparkle" width="24" height="24" />
            </div>

            <div class="flex-1">
              <div class="text-base font-bold">
                Penny
              </div>
              <div class="text-xs opacity-70">
                Your bill-splitting copilot
              </div>
            </div>

            <div class="chip" :style="{ background: health?.piReady ? 'var(--mint)' : 'rgba(255,255,255,0.12)', color: health?.piReady ? 'var(--ink)' : 'var(--cream)' }">
              {{ health?.piReady ? 'on' : 'off' }}
            </div>
          </div>

          <div class="mt-[14px] text-[13px] leading-[1.4] opacity-[0.85]">
            She reads receipts, suggests who owes what, and turns messy group tabs into a split you can actually settle.
          </div>
        </div>
      </div>
    </div>

    <div class="section-pad mt-4">
      <div class="surface-panel overflow-hidden">
        <div
          v-for="([label, detail], index) in settings"
          :key="label"
          class="flex items-center px-4 py-[14px]"
          :class="index < settings.length - 1 ? 'border-b border-black/8' : ''"
        >
          <div class="flex-1 text-[15px] font-medium">
            {{ label }}
          </div>
          <span v-if="detail" class="mono mr-2 text-xs text-muted">
            {{ detail }}
          </span>
        </div>
      </div>
    </div>

    <div class="section-pad mt-4">
      <div class="section-label mb-2.5">
        Debug tools
      </div>
      <div class="surface-panel mb-3 p-[18px]">
        <div class="flex flex-wrap items-center gap-2.5">
          <button
            class="btn btn-accent"
            :disabled="saving"
            :class="'btn-xs'"
            @click="emit('add-to-all-groups')"
          >
            {{ saving ? 'Adding you...' : 'Add me to all groups' }}
          </button>

          <div class="mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Testing only
          </div>
        </div>
      </div>
      <CreatePersonForm
        :person-name="personName"
        :saving="saving"
        @submit="emit('submit-person')"
        @update:person-name="emit('update:person-name', $event)"
      />
    </div>

    <div class="section-pad mt-[22px] text-center">
      <div class="mono text-[10px] tracking-[0.15em] text-muted">
        KEEP THE TAB FAIR · KEEP THE LEDGER CLEAN
      </div>
    </div>
  </div>
</template>
