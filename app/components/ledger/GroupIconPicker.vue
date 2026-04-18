<script setup lang="ts">
import { groupIconOptions } from '../../../shared/group-icons'

defineProps({
  modelValue: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div style="margin-top: 14px;">
    <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em;">
      Pick an icon
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
      <button
        v-for="icon in groupIconOptions"
        :key="icon"
        :aria-pressed="modelValue === icon"
        :style="{
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          border: modelValue === icon ? '1.5px solid var(--ink)' : '1.5px solid rgba(20,18,16,0.12)',
          background: modelValue === icon ? 'var(--cream-2)' : 'var(--paper)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          boxShadow: modelValue === icon ? '0 0 0 2px rgba(20,18,16,0.06)' : '',
        }"
        type="button"
        @click="emit('update:modelValue', icon)"
      >
        {{ icon }}
      </button>
    </div>
  </div>
</template>
