<script setup>
import { computed } from 'vue'
import IconGlyph from './IconGlyph.vue'

const route = useRoute()

const activeTab = computed(() => {
  if (route.path === '/') {
    return 'home'
  }

  if (route.path === '/chats') {
    return 'splits'
  }

  if (route.path === '/profile') {
    return 'profile'
  }

  if (route.path === '/scan' || route.path.startsWith('/scan/') || route.path === '/chat-split') {
    return 'scan'
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

        <button class="tab-fab" :class="{ active: activeTab === 'scan' }" aria-label="Scan receipt" @click="goTo('/scan')">
          <IconGlyph name="scan" />
        </button>

        <button class="tab" :class="{ active: activeTab === 'splits' }" @click="goTo('/chats')">
          <IconGlyph name="chat" />
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
