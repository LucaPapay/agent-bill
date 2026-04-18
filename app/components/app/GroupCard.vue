<script setup>
import AvatarBadge from './AvatarBadge.vue'

const props = defineProps({
  amountLabel: {
    type: String,
    required: true,
  },
  avatarNames: {
    type: Array,
    default: () => [],
  },
  iconBackground: {
    type: String,
    default: 'var(--marigold)',
  },
  iconColor: {
    type: String,
    default: 'var(--ink)',
  },
  iconLabel: {
    type: String,
    required: true,
  },
  selected: Boolean,
  subtitle: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['select'])
</script>

<template>
  <button
    class="surface-panel"
    :style="{
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      textAlign: 'left',
      borderColor: selected ? 'var(--ink)' : 'rgba(20,18,16,0.08)',
      boxShadow: selected ? '0 0 0 2px rgba(20,18,16,0.06)' : '',
      width: '100%',
    }"
    @click="emit('select')"
  >
    <div style="display: flex; align-items: center; gap: 12px;">
      <div
        :style="{
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: iconBackground,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 700,
          border: '1.5px solid var(--ink)',
        }"
      >
        {{ iconLabel }}
      </div>

      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 17px;">
          {{ title }}
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
          {{ subtitle }}
        </div>
      </div>

      <div class="mono" style="font-weight: 700; font-size: 13px; text-align: right;">
        {{ amountLabel }}
      </div>
    </div>

    <div style="display: flex; margin-top: 12px; padding-left: 4px;">
      <div
        v-for="(name, index) in avatarNames.slice(0, 4)"
        :key="name"
        :style="{ marginLeft: index === 0 ? 0 : '-10px' }"
      >
        <AvatarBadge :name="name" size="sm" />
      </div>

      <div
        v-if="avatarNames.length > 4"
        class="avatar sm"
        style="margin-left: -10px; background: var(--cream-2);"
      >
        +{{ avatarNames.length - 4 }}
      </div>
    </div>
  </button>
</template>
