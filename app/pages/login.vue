<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const api = useOrpc()
const { loginAsUser } = useLedgerState()

const users = ref<any[]>([])
const loading = ref(true)
const creating = ref(false)
const errorMessage = ref('')
const newUserName = ref('')
const pendingUserId = ref('')

const hasUsers = computed(() => users.value.length > 0)

function loadUsers() {
  loading.value = true

  return api.listLedgerUsers().then(
    (value: any) => {
      users.value = value
    },
    (error: any) => {
      errorMessage.value = error?.message || 'Could not load users.'
    },
  ).finally(() => {
    loading.value = false
  })
}

function chooseUser(userId: string) {
  if (!userId || pendingUserId.value) {
    return
  }

  errorMessage.value = ''
  pendingUserId.value = userId

  loginAsUser(userId).then((didLoad) => {
    if (didLoad) {
      navigateTo('/')
      return
    }

    errorMessage.value = errorMessage.value || 'Could not start that session.'
    pendingUserId.value = ''
  })
}

function createUser() {
  const name = newUserName.value.trim()

  if (!name) {
    return
  }

  errorMessage.value = ''
  creating.value = true

  api.createLedgerPerson({
    name,
  }).then(
    () => {
      newUserName.value = ''
      return loadUsers()
    },
    (error: any) => {
      errorMessage.value = error?.message || 'Could not create the user.'
    },
  ).finally(() => {
    creating.value = false
  })
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <main class="app-root">
    <div class="app-view" style="display: grid; place-items: center; padding: 24px;">
      <div style="width: min(100%, 560px); display: grid; gap: 18px;">
        <div class="surface-panel" style="padding: 24px;">
          <div class="mono" style="font-size: 11px; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase;">
            Login
          </div>
          <h1 class="h-display" style="font-size: clamp(36px, 8vw, 56px); line-height: 0.95; margin: 12px 0 0;">
            Choose a user.
          </h1>
          <p style="margin: 14px 0 0; font-size: 15px; line-height: 1.55; color: var(--muted);">
            This is still fake login. For now you pick an existing person, and the app scopes groups and bills to that person.
          </p>
        </div>

        <div class="surface-panel" style="padding: 20px;">
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">
            Create user
          </div>

          <form style="display: flex; gap: 10px; flex-wrap: wrap;" @submit.prevent="createUser">
            <input
              v-model="newUserName"
              type="text"
              placeholder="Alice"
              :disabled="creating || Boolean(pendingUserId)"
              style="flex: 1 1 220px; border: 1.5px solid rgba(20,18,16,0.12); border-radius: 16px; background: var(--paper); padding: 12px 14px; outline: none;"
            >
            <button class="btn btn-primary" :disabled="creating || Boolean(pendingUserId) || !newUserName.trim()">
              Create
            </button>
          </form>
        </div>

        <div class="surface-panel" style="padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap;">
            <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em;">
              Choose existing user
            </div>
            <div class="mono" style="font-size: 11px; color: var(--muted);">
              {{ users.length }} saved
            </div>
          </div>

          <div v-if="loading" style="margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
            Loading users...
          </div>

          <div v-else-if="hasUsers" style="display: grid; gap: 10px; margin-top: 14px;">
            <button
              v-for="user in users"
              :key="user.id"
              class="btn btn-ghost"
              :disabled="Boolean(pendingUserId)"
              style="justify-content: space-between; padding: 14px 16px;"
              @click="chooseUser(user.id)"
            >
              <span style="font-weight: 700;">{{ user.name }}</span>
              <span class="mono" style="font-size: 11px; opacity: 0.7;">
                {{ pendingUserId === user.id ? 'Opening...' : 'Use this user' }}
              </span>
            </button>
          </div>

          <div v-else style="margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--paper); font-size: 13px;">
            No users yet. Create the first one above.
          </div>
        </div>

        <div
          v-if="errorMessage"
          style="padding: 12px 14px; border-radius: 16px; background: #fff0ec; color: #7d2f21; border: 1px solid rgba(255,84,54,0.2); font-size: 13px;"
        >
          {{ errorMessage }}
        </div>
      </div>
    </div>
  </main>
</template>
