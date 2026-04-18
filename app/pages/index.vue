<script setup>
import { computed, ref } from 'vue'
import BottomTabBar from '../components/app/BottomTabBar.vue'
import AssignScreen from '../components/screens/AssignScreen.vue'
import ChatSplitScreen from '../components/screens/ChatSplitScreen.vue'
import GroupsScreen from '../components/screens/GroupsScreen.vue'
import HomeScreen from '../components/screens/HomeScreen.vue'
import ProfileScreen from '../components/screens/ProfileScreen.vue'
import ScanScreen from '../components/screens/ScanScreen.vue'
import SettledScreen from '../components/screens/SettledScreen.vue'

const screen = ref('home')
const resultLayout = ref('cards')

const activeTab = computed(() => {
  if (screen.value === 'assign') {
    return 'assign'
  }

  if (['home', 'groups', 'profile'].includes(screen.value)) {
    return screen.value
  }

  return ''
})

function handleScanDone() {
  screen.value = 'chat'
}
</script>

<template>
  <main class="app-root">
    <div class="app-view">
      <BottomTabBar :active-tab="activeTab" @nav="screen = $event" />

      <HomeScreen v-if="screen === 'home'" @nav="screen = $event" @open-bill="screen = 'assign'" />
      <GroupsScreen v-else-if="screen === 'groups'" />
      <ProfileScreen v-else-if="screen === 'profile'" />
      <ScanScreen v-else-if="screen === 'scan'" @done="handleScanDone" />
      <ChatSplitScreen v-else-if="screen === 'chat'" @done="screen = 'settled'" @jump-to-items="screen = 'assign'" />
      <AssignScreen
        v-else-if="screen === 'assign'"
        :layout="resultLayout"
        @done="screen = 'settled'"
        @update:layout="resultLayout = $event"
      />
      <SettledScreen v-else-if="screen === 'settled'" @nav="screen = $event" />
      <HomeScreen v-else @nav="screen = $event" @open-bill="screen = 'assign'" />
    </div>
  </main>
</template>
