export default defineEventHandler(() => ({
  googleConfigured: Boolean(
    process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID
    && process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET,
  ),
}))
