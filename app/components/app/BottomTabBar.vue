<script setup>
import IconGlyph from './IconGlyph.vue'

defineProps({
  activeTab: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['nav'])
</script>

<template>
  <div class="tab-bar">
    <button class="tab" :class="{ active: activeTab === 'home' }" @click="emit('nav', 'home')">
      <IconGlyph name="home" />
      <span>Home</span>
    </button>

    <button class="tab" :class="{ active: activeTab === 'groups' }" style="margin-right: 8px" @click="emit('nav', 'groups')">
      <IconGlyph name="groups" />
      <span>Groups</span>
    </button>

    <button class="tab-fab" aria-label="Scan receipt" @click="emit('nav', 'scan')">
      <IconGlyph name="scan" />
    </button>

    <button class="tab" :class="{ active: activeTab === 'assign' }" style="margin-left: 8px" @click="emit('nav', 'assign')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
        <path d="M3 6h18M3 12h18M3 18h12" />
      </svg>
      <span>Splits</span>
    </button>

    <button class="tab" :class="{ active: activeTab === 'profile' }" @click="emit('nav', 'profile')">
      <IconGlyph name="profile" />
      <span>You</span>
    </button>
  </div>
</template>
