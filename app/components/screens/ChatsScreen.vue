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
    <div class="section-pad" style="padding-top: 8px; padding-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
        <div>
          <h1 class="h-display" style="font-size: 42px; line-height: 1; margin: 0;">
            Splits
          </h1>
          <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 6px;">
            {{ chats.length ? `${chats.length} saved split chats` : 'No saved split chats yet' }}
          </div>
        </div>

        <button class="btn btn-accent" @click="startNewSplit">
          New split
        </button>
      </div>
    </div>

    <div class="section-pad" style="padding-bottom: 96px;">
      <div v-if="loading" class="surface-panel" style="padding: 18px 20px;">
        <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
          Loading
        </div>
        <div style="font-size: 15px; line-height: 1.5; margin-top: 8px;">
          Fetching your saved split chats.
        </div>
      </div>

      <div v-else-if="!chats.length" class="surface-panel" style="padding: 20px;">
        <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
          Empty
        </div>
        <div style="font-size: 15px; line-height: 1.5; margin-top: 8px;">
          Start a split from Scan. Once Penny finishes, that split chat will live here and reopening it will send you back to the scan screen.
        </div>
      </div>

      <div v-else style="display: grid; gap: 12px;">
        <button
          v-for="chat in chats"
          :key="chat.chatId"
          class="surface-panel"
          style="padding: 16px 18px; text-align: left; display: grid; gap: 10px;"
          @click="openChat(chat.chatId)"
        >
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div style="min-width: 0;">
              <div style="font-size: 17px; font-weight: 700; line-height: 1.2;">
                {{ chat.title }}
              </div>
              <div style="font-size: 13px; color: var(--muted); line-height: 1.45; margin-top: 4px;">
                {{ chat.people.join(', ') || 'No people saved' }}
              </div>
            </div>

            <div class="mono" style="font-size: 12px; color: var(--muted); white-space: nowrap;">
              {{ formatUpdatedAt(chat.updatedAt) }}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="font-size: 13px; color: var(--muted); line-height: 1.45;">
              {{ chat.summary || 'Open this saved split in Scan.' }}
            </div>

            <div style="display: inline-flex; align-items: center; gap: 8px;">
              <div class="mono" style="font-size: 13px; font-weight: 700;">
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
