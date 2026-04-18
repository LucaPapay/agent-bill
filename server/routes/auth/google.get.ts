import { findOrCreateGooglePerson } from '../../lib/db/groups'

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    const person = await findOrCreateGooglePerson({
      avatarUrl: String(user.picture || ''),
      email: String(user.email || ''),
      googleSub: String(user.sub || ''),
      name: String(user.name || user.email || 'Google user'),
    })

    await setUserSession(event, {
      loggedInAt: new Date().toISOString(),
      user: {
        avatarUrl: person.avatarUrl,
        email: person.email,
        name: person.name,
        personId: person.id,
      },
    })

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    const message = String(error?.message || '')

    if (message.includes('NUXT_OAUTH_GOOGLE_CLIENT_ID') || message.includes('NUXT_OAUTH_GOOGLE_CLIENT_SECRET')) {
      return sendRedirect(event, '/login?error=google-config')
    }

    return sendRedirect(event, '/login?error=google-oauth')
  },
})
