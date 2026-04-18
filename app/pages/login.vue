<script setup lang="ts">
const route = useRoute()
const loginHref = '/auth/google'
const { data } = await useFetch('/api/auth/status')

const errorMessage = computed(() => {
  if (route.query.error === 'google-config') {
    return 'Google OAuth is not configured yet. Add the Google client id and secret to your .env and restart Nuxt.'
  }

  if (route.query.error === 'google-oauth') {
    return 'Google login failed before the session could be created. Check the server logs and your Google redirect URI.'
  }

  return ''
})

const googleConfigured = computed(() => Boolean(data.value?.googleConfigured))
</script>

<template>
  <main class="app-root" style="padding: 24px;">
    <div class="app-view" style="display: grid; place-items: center; min-height: calc(100vh - 48px);">
      <div class="surface-panel" style="width: min(440px, 100%); padding: 28px;">
        <div class="mono" style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);">
          Agent-Bill
        </div>

        <h1 class="h-display" style="font-size: clamp(40px, 8vw, 56px); line-height: 0.95; margin: 14px 0 0;">
          Sign in to keep your ledger private.
        </h1>

        <p style="font-size: 15px; line-height: 1.6; color: var(--muted); margin: 18px 0 0;">
          Google login unlocks your own groups, people, bills, and receipt analysis history on this install.
        </p>

        <div v-if="errorMessage" style="padding: 12px 14px; border-radius: 16px; background: #fff0ec; color: #7d2f21; border: 1px solid rgba(255,84,54,0.2); font-size: 13px; margin-top: 20px;">
          {{ errorMessage }}
        </div>

        <div v-if="!googleConfigured" style="padding: 12px 14px; border-radius: 16px; background: rgba(20,18,16,0.04); color: var(--ink); border: 1px solid rgba(20,18,16,0.08); font-size: 13px; line-height: 1.5; margin-top: 20px;">
          Missing Google OAuth config.
          Add `NUXT_OAUTH_GOOGLE_CLIENT_ID` and `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` to `.env`, then restart the dev server.
        </div>

        <a
          class="btn btn-accent"
          :href="googleConfigured ? loginHref : undefined"
          :style="{
            display: 'inline-flex',
            textDecoration: 'none',
            marginTop: '24px',
            width: '100%',
            justifyContent: 'center',
            opacity: googleConfigured ? 1 : 0.55,
            pointerEvents: googleConfigured ? 'auto' : 'none',
          }"
        >
          Continue with Google
        </a>

        <div style="display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap;">
          <span class="chip chip-muted">Google only</span>
          <span class="chip chip-muted">Cookie session</span>
          <span class="chip chip-muted">Postgres-backed ledger</span>
        </div>
      </div>
    </div>
  </main>
</template>
