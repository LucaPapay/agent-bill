<script setup>
import { onMounted, ref } from 'vue'
import SavedChatCard from '../app/SavedChatCard.vue'

const api = useOrpc()
const loading = ref(true)
const chats = ref([])

async function startNewSplit() {
  await navigateTo('/scan')
}

onMounted(() => {
  api.listBillChats().then((value) => {
    chats.value = Array.isArray(value) ? value : []
  }).finally(() => {
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
        <SavedChatCard
          v-for="chat in chats"
          :key="chat.chatId"
          :action-label="chat.linkedBillId && chat.linkedBillGroupId ? 'Open bill' : ''"
          :action-to="chat.linkedBillId && chat.linkedBillGroupId ? `/groups/${chat.linkedBillGroupId}/bills/${chat.linkedBillId}` : ''"
          :chat="chat"
          :to="`/scan/${chat.chatId}`"
        />
      </div>
    </div>
  </div>
</template>
