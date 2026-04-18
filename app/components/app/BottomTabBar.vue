<script setup>
import { computed } from 'vue'
import IconGlyph from './IconGlyph.vue'

const route = useRoute()
const { selectedGroupId } = useLedgerState()

const activeTab = computed(() => {
  if (route.path === '/') {
    return 'home'
  }

  if (route.path === '/chats') {
    return 'chats'
  }

  if (route.path === '/profile') {
    return 'profile'
  }

  if (route.path === '/scan' || route.path.startsWith('/scan/') || route.path === '/chat-split') {
    return 'scan'
  }

  if (route.path.endsWith('/bills/new')) {
    return 'assign'
  }

  if (route.path.startsWith('/groups')) {
    return 'groups'
  }

  return ''
})

function goTo(path) {
  navigateTo(path)
}
</script>

<template>
  <div class="tab-bar">
    <div class="tab-inner">
      <div class="tab-brand">
        <span class="tab-brand-title">agent-bill</span>
        <span class="tab-brand-subtitle">scan receipts. settle cleanly.</span>
      </div>

      <div class="tab-links">
        <button class="tab" :class="{ active: activeTab === 'home' }" @click="goTo('/')">
          <IconGlyph name="home" />
          <span>Home</span>
        </button>

        <button class="tab" :class="{ active: activeTab === 'groups' }" @click="goTo('/groups')">
          <IconGlyph name="groups" />
          <span>Groups</span>
        </button>

        <button class="tab" :class="{ active: activeTab === 'chats' }" @click="goTo('/chats')">
          <IconGlyph name="chat" />
          <span>Chats</span>
        </button>

        <button class="tab-fab" :class="{ active: activeTab === 'scan' }" aria-label="Scan receipt" @click="goTo('/scan')">
          <IconGlyph name="scan" />
        </button>

        <button
          class="tab"
          :class="{ active: activeTab === 'assign' }"
          @click="goTo(selectedGroupId ? `/groups/${selectedGroupId}/bills/new` : '/groups')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
            <path d="M3 6h18M3 12h18M3 18h12" />
          </svg>
          <span>Splits</span>
        </button>

        <button class="tab" :class="{ active: activeTab === 'profile' }" @click="goTo('/profile')">
          <IconGlyph name="profile" />
          <span>You</span>
        </button>
      </div>
    </div>
  </div>
</template>
