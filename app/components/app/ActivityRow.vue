<script setup>
defineProps({
  emoji: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  sub: {
    type: String,
    required: true,
  },
  amount: {
    type: String,
    required: true,
  },
  accent: {
    type: String,
    required: true,
  },
  owed: Boolean,
})

const emit = defineEmits(['select'])
</script>

<template>
  <button
    style="background: var(--paper); border-radius: 18px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; border: 1px solid rgba(20,18,16,0.08); text-align: left; width: 100%;"
    @click="emit('select')"
  >
    <div
      :style="{
        width: '44px',
        height: '44px',
        borderRadius: '14px',
        background: accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '22px',
        flexShrink: 0,
      }"
    >
      {{ emoji }}
    </div>

    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 700; font-size: 15px;">
        {{ title }}
      </div>
      <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
        {{ sub }}
      </div>
    </div>

    <div class="mono" :style="{ fontWeight: 700, fontSize: '14px', color: owed ? 'var(--ink)' : 'var(--muted)' }">
      {{ amount }}
    </div>
  </button>
</template>
