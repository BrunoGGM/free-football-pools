export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()

  if (!user.value) {
    return navigateTo('/auth')
  }

  const client = useSupabaseClient<any>()
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('is_global_admin')
    .eq('id', user.value.id)
    .maybeSingle()

  if (!profileError && profile?.is_global_admin) {
    return
  }

  const activeQuinielaId = useCookie<string | null>('active_quiniela_id')

  if (!activeQuinielaId.value) {
    return navigateTo('/ingresar')
  }

  const { data, error } = await client
    .from('quinielas')
    .select('id')
    .eq('id', activeQuinielaId.value)
    .eq('admin_id', user.value.id)
    .maybeSingle()

  if (error || !data) {
    return navigateTo('/dashboard')
  }
})
