<script setup lang="ts">
import { onMounted } from 'vue'
import BottomTabBar from '../app/BottomTabBar.vue'

const { ensureLoaded } = useLedgerState()

onMounted(() => {
  ensureLoaded()
})
</script>

<template>
  <main class="app-root">
    <div class="app-view">
      <BottomTabBar />
      <slot />
    </div>
  </main>
</template>
