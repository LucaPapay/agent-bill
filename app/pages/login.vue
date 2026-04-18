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
        <div style="display: inline-flex; align-items: center; gap: 14px;">
          <div
            style="width: 64px; height: 64px; border-radius: 20px; display: grid; place-items: center; padding: 9px; background: linear-gradient(180deg, rgba(255, 253, 250, 0.94) 0%, rgba(240, 223, 198, 0.92) 100%); box-shadow: 0 16px 36px rgba(95, 63, 29, 0.14); flex-shrink: 0;"
          >
            <img
              src="/agent-bill-no-bg.png"
              alt="agent-bill"
              style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 10px 18px rgba(95, 63, 29, 0.12));"
            >
          </div>

          <div style="display: grid; gap: 4px;">
            <div class="h-display" style="font-size: clamp(42px, 7vw, 58px); line-height: 0.92; letter-spacing: -0.03em;">
              agent-bill
            </div>
            <div class="mono" style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);">
              Scan receipts. Settle cleanly.
            </div>
          </div>
        </div>
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
            minHeight: '58px',
            justifyContent: 'center',
            borderRadius: '999px',
            boxShadow: '0 8px 20px rgba(255, 84, 54, 0.5), inset 0 -3px 0 rgba(0, 0, 0, 0.18)',
            opacity: googleConfigured ? 1 : 0.55,
            pointerEvents: googleConfigured ? 'auto' : 'none',
          }"
        >
          Continue with Google
        </a>
      </div>
    </div>
  </main>
</template>
