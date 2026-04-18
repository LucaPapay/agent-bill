export default defineNuxtRouteMiddleware((to) => {
  const { currentUserId } = useLedgerState()
  const isLoginRoute = to.path === '/login'

  if (!currentUserId.value && !isLoginRoute) {
    return navigateTo('/login')
  }

  if (currentUserId.value && isLoginRoute) {
    return navigateTo('/')
  }
})
