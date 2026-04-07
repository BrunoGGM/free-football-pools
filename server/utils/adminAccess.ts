import { createError, getHeader, type H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any
  }
  auth: {
    getUser: (jwt?: string) => Promise<{ data: { user: any | null }; error: any | null }>
  }
}

async function resolveAuthenticatedUser(event: H3Event, supabase: SupabaseLike) {
  try {
    const cookieUser = await serverSupabaseUser(event)
    if (cookieUser) {
      return cookieUser
    }
  } catch {
    // fallback below
  }

  const authHeader = getHeader(event, 'authorization') || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return null
  }

  return data.user
}

export async function requireAdminAccess(event: H3Event, supabase: SupabaseLike) {
  const user = await resolveAuthenticatedUser(event, supabase)

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
  const user = await resolveAuthenticatedUser(event, supabase)

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
