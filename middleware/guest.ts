export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  const authMode = Array.isArray(to.query.mode) ? to.query.mode[0] : to.query.mode
  const allowsAuthenticatedAccess =
    to.path === '/auth' && (authMode === 'reset' || authMode === 'update-password')

  if (user.value) {
    if (allowsAuthenticatedAccess) {
      return
    }

    return navigateTo('/dashboard')
  }
})
