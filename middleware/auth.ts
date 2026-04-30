export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()

  if (!user.value) {
    return navigateTo({
      path: '/auth',
      query: {
        redirect: to.fullPath,
      },
    })
  }

  const { activeQuinielaId, ensureActiveQuiniela } = useActiveQuiniela()

  if (!activeQuinielaId.value) {
    await ensureActiveQuiniela()
  }
})
