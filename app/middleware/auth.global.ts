export default defineNuxtRouteMiddleware(async (to) => {
  const { fetch, loggedIn, ready } = useUserSession()

  if (!ready.value) {
    await fetch()
  }

  if (to.path === '/login') {
    if (loggedIn.value) {
      return navigateTo('/')
    }

    return
  }

  if (loggedIn.value) {
    return
  }

  useLedgerState().resetState()
  return navigateTo('/login')
})
