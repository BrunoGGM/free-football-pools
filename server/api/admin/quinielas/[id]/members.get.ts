import { createError, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user, isGlobalAdmin } = await requireAdminAccess(event, supabase)
  const id = getRouterParam(event, 'id')?.trim()

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  if (!isGlobalAdmin) {
    const { data: quiniela, error: qError } = await supabase
      .from('quinielas')
      .select('admin_id')
      .eq('id', id)
      .maybeSingle()

    if (qError || !quiniela || quiniela.admin_id !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'No tienes permisos para esta quiniela' })
    }
  }

  const { data: members, error: mError } = await supabase
    .from('quiniela_members')
    .select('user_id')
    .eq('quiniela_id', id)

  if (mError) {
    throw createError({ statusCode: 500, statusMessage: mError.message })
  }

  const userIds = members?.map((m: any) => m.user_id) || []
  if (userIds.length === 0) {
    return { ok: true, members: [] }
  }

  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds)

  if (pError) {
    throw createError({ statusCode: 500, statusMessage: pError.message })
  }

  const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p.username]))

  // Fetch emails from auth.users
  const authUsersMap = new Map<string, string>()
  
  try {
    // Note: listUsers is paginated, we fetch up to 1000 users for simplicity.
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })

    if (!authError && authData?.users) {
      for (const u of authData.users) {
        authUsersMap.set(u.id, u.email || 'Sin email')
      }
    }
  } catch (err) {
    console.error('Error loading auth users:', err)
  }

  const mappedMembers = userIds.map((uid: string) => ({
    id: uid,
    username: profilesMap.get(uid) || 'Desconocido',
    email: authUsersMap.get(uid) || 'Sin email',
  }))

  // sort by username
  mappedMembers.sort((a, b) => a.username.localeCompare(b.username))

  return {
    ok: true,
    members: mappedMembers,
  }
})
