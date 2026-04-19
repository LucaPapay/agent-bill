<script setup>
import { computed, onMounted, ref } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'
import { useBillAnalysisStream } from '../../composables/useBillAnalysisStream'

const analysis = useBillAnalysisStream()
const loading = ref(true)
const chats = computed(() => analysis.recentChats.value || [])

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

async function openChat(chatId) {
  await navigateTo(`/scan/${chatId}`)
}

async function startNewSplit() {
  await navigateTo('/scan')
}

onMounted(() => {
  analysis.loadChats().finally(() => {
    loading.value = false
  })
})
</script>

<template>
  <div class="screen">
    <div class="section-pad pb-4 pt-2">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="h-display m-0 text-[42px] leading-none">
            Splits
          </h1>
          <div class="mono mt-1.5 text-[11px] text-muted">
            {{ chats.length ? `${chats.length} saved split chats` : 'No saved split chats yet' }}
          </div>
        </div>

        <button class="btn btn-accent" @click="startNewSplit">
          New split
        </button>
      </div>
    </div>

    <div class="section-pad pb-24">
      <div v-if="loading" class="surface-panel px-5 py-[18px]">
        <div class="section-label">
          Loading
        </div>
        <div class="mt-2 text-[15px] leading-[1.5]">
          Fetching your saved split chats.
        </div>
      </div>

      <div v-else-if="!chats.length" class="surface-panel p-5">
        <div class="section-label">
          Empty
        </div>
        <div class="mt-2 text-[15px] leading-[1.5]">
          Start a split from Scan. Once Penny finishes, that split chat will live here and reopening it will send you back to the scan screen.
        </div>
      </div>

      <div v-else class="grid gap-3">
        <button
          v-for="chat in chats"
          :key="chat.chatId"
          class="surface-panel grid gap-2.5 px-[18px] py-4 text-left"
          @click="openChat(chat.chatId)"
        >
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

          <div class="flex flex-wrap items-center justify-between gap-3">
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
        </button>
      </div>
    </div>
  </div>
</template>
