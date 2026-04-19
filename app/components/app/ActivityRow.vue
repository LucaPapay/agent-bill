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
    class="flex w-full items-center gap-3 rounded-[18px] border border-black/8 bg-paper px-[14px] py-3 text-left"
    @click="emit('select')"
  >
    <div
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[22px]"
      :style="{
        background: accent,
      }"
    >
      {{ emoji }}
    </div>

    <div class="min-w-0 flex-1">
      <div class="text-[15px] font-bold">
        {{ title }}
      </div>
      <div class="mt-0.5 text-xs text-muted">
        {{ sub }}
      </div>
    </div>

    <div class="mono text-[14px] font-bold" :class="owed ? 'text-ink' : 'text-muted'">
      {{ amount }}
    </div>
  </button>
</template>
