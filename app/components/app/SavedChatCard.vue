<script setup>
import IconGlyph from './IconGlyph.vue'

function formatMoney(amountCents, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    currency,
    style: 'currency',
  }).format((amountCents || 0) / 100)
}

function formatUpdatedAt(value) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

defineProps({
  actionLabel: {
    type: String,
    default: '',
  },
  actionTo: {
    type: String,
    default: '',
  },
  chat: {
    type: Object,
    required: true,
  },
  to: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="surface-panel overflow-hidden">
    <NuxtLink :to="to" class="block px-[18px] py-4 text-left no-underline text-ink">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[17px] font-bold leading-[1.2]">
            {{ chat.title }}
          </div>
          <div class="mt-1 text-[13px] leading-[1.45] text-muted">
            {{ chat.people.join(', ') || 'No people saved' }}
          </div>
        </div>

        <div class="mono whitespace-nowrap text-xs text-muted">
          {{ formatUpdatedAt(chat.updatedAt) }}
        </div>
      </div>

      <div class="mt-2.5 flex flex-wrap items-center justify-between gap-3">
        <div class="text-[13px] leading-[1.45] text-muted">
          {{ chat.summary || 'Open this saved split in Scan.' }}
        </div>

        <div class="inline-flex items-center gap-2">
          <div class="mono text-[13px] font-bold">
            {{ formatMoney(chat.totalCents || 0) }}
          </div>
          <IconGlyph name="chevron" width="16" height="16" />
        </div>
      </div>
    </NuxtLink>

    <div v-if="actionTo && actionLabel" class="flex justify-end border-t border-[rgba(20,18,16,0.08)] px-[18px] py-3">
      <NuxtLink class="chip chip-muted chip-action no-underline" :to="actionTo">
        {{ actionLabel }}
      </NuxtLink>
    </div>
  </div>
</template>
