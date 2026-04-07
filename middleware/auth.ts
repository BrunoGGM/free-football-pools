export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()

  if (!user.value) {
    return navigateTo('/auth')
  }

  const { activeQuinielaId, ensureActiveQuiniela } = useActiveQuiniela()

  if (!activeQuinielaId.value) {
    await ensureActiveQuiniela()
  }
})
