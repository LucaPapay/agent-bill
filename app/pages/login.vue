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
  <main class="app-root p-6">
    <div class="app-view grid min-h-[calc(100vh-48px)] place-items-center">
      <div class="surface-panel w-full max-w-[440px] p-7">
        <div class="inline-flex items-center gap-[14px]">
          <div
            class="grid h-16 w-16 shrink-0 place-items-center rounded-[20px] bg-[linear-gradient(180deg,rgba(255,253,250,0.94)_0%,rgba(240,223,198,0.92)_100%)] p-[9px] shadow-[0_16px_36px_rgba(95,63,29,0.14)]"
          >
            <img
              src="/agent-bill-no-bg.png"
              alt="agent-bill"
              class="h-full w-full object-contain [filter:drop-shadow(0_10px_18px_rgba(95,63,29,0.12))]"
            >
          </div>

          <div class="grid gap-1">
            <div class="h-display text-[clamp(42px,7vw,58px)] leading-[0.92] tracking-[-0.03em]">
              agent-bill
            </div>
            <div class="section-label-tight">
              Scan receipts. Settle cleanly.
            </div>
          </div>
        </div>
        <div v-if="errorMessage" class="callout-error mt-5">
          {{ errorMessage }}
        </div>

        <div v-if="!googleConfigured" class="callout-muted mt-5">
          Missing Google OAuth config.
          Add `NUXT_OAUTH_GOOGLE_CLIENT_ID` and `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` to `.env`, then restart the dev server.
        </div>

        <a
          class="btn btn-accent mt-6 inline-flex min-h-[58px] w-full justify-center shadow-[0_8px_20px_rgba(255,84,54,0.5),inset_0_-3px_0_rgba(0,0,0,0.18)]"
          :href="googleConfigured ? loginHref : undefined"
          :class="googleConfigured ? 'opacity-100 pointer-events-auto no-underline' : 'pointer-events-none opacity-[0.55] no-underline'"
        >
          Continue with Google
        </a>
      </div>
    </div>
  </main>
</template>
