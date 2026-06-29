import { createError, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../utils/adminAccess'

type TeamProfilesQuery = {
  q?: string
  limit?: string
  offset?: string
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireAdminAccess(event, supabase)

  const query = getQuery(event) as TeamProfilesQuery
  const search = (query.q || '').trim()
  const limit = Math.min(100, Math.max(1, Number(query.limit || 25)))
  const offset = Math.max(0, Number(query.offset || 0))

  let dbQuery = supabase
    .from('team_profiles')
    .select(
      'id, api_team_id, team_key, name, code, country, logo_url, is_national, source_provider, updated_at',
      { count: 'exact' },
    )
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (search) {
    const escaped = search.replace(/[%_]/g, '')
    dbQuery = dbQuery.or(
      `name.ilike.%${escaped}%,team_key.ilike.%${escaped}%,code.ilike.%${escaped}%,country.ilike.%${escaped}%`,
    )
  }

  const { data, error, count } = await dbQuery

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    ok: true,
    items: data || [],
    total: Number(count || 0),
    limit,
    offset,
  }
})
