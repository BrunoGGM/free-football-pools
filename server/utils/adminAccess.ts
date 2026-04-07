import { createError, type H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any
  }
}

export async function requireAdminAccess(event: H3Event, supabase: SupabaseLike) {
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_global_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message })
  }

  const isGlobalAdmin = Boolean(profile?.is_global_admin)

  if (isGlobalAdmin) {
    return { user, isGlobalAdmin }
  }

  const { data: adminCheck, error: adminCheckError } = await supabase
    .from('quinielas')
    .select('id')
    .eq('admin_id', user.id)
    .limit(1)

  if (adminCheckError) {
    throw createError({ statusCode: 500, statusMessage: adminCheckError.message })
  }

  if (!adminCheck || adminCheck.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'Solo admins pueden acceder' })
  }

  return { user, isGlobalAdmin: false }
}

export async function requireGlobalAdminAccess(event: H3Event, supabase: SupabaseLike) {
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_global_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message })
  }

  if (!profile?.is_global_admin) {
    throw createError({ statusCode: 403, statusMessage: 'Solo global admins pueden acceder' })
  }

  return { user, isGlobalAdmin: true }
}
