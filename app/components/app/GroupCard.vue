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
    class="surface-panel flex w-full self-start flex-col items-stretch justify-start px-[18px] py-4 text-left"
    :class="selected ? 'border-ink shadow-[0_0_0_2px_rgba(20,18,16,0.06)]' : 'border-black/8'"
    @click="emit('select')"
  >
    <div class="flex items-center gap-3">
      <div
        class="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border-[1.5px] border-ink text-2xl leading-none font-bold"
        :style="{
          background: iconBackground,
          color: iconColor,
        }"
      >
        {{ iconLabel }}
      </div>

      <div class="min-w-0 flex-1">
        <div class="text-[17px] font-bold">
          {{ title }}
        </div>
        <div class="mt-0.5 text-xs text-muted">
          {{ subtitle }}
        </div>
      </div>

      <div class="mono text-right text-[13px] font-bold">
        {{ amountLabel }}
      </div>
    </div>

    <div class="mt-3 flex pl-1">
      <div
        v-for="(name, index) in avatarNames.slice(0, 4)"
        :key="name"
        :class="index === 0 ? 'ml-0' : 'ml-[-10px]'"
      >
        <AvatarBadge :name="name" size="sm" />
      </div>

      <div
        v-if="avatarNames.length > 4"
        class="avatar sm ml-[-10px] bg-cream-2"
      >
        +{{ avatarNames.length - 4 }}
      </div>
    </div>
  </button>
</template>
