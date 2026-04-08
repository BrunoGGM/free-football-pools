import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../utils/adminAccess'
import { normalizeTeamKey } from '../../../utils/teamMeta'

type CreateTeamProfileBody = {
  name?: string
  code?: string | null
  country?: string | null
  logo_url?: string | null
  api_team_id?: number | null
  is_national?: boolean | null
  source_provider?: string | null
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const parsed = value.trim()
  return parsed || null
}

function validateLogoUrl(value: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Protocolo invalido')
    }
    return value
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'logo_url invalido' })
  }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireGlobalAdminAccess(event, supabase)

  const body = (await readBody(event).catch(() => ({}))) as CreateTeamProfileBody

  const name = (body.name || '').trim()
  if (name.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Nombre invalido (minimo 2 caracteres)' })
  }

  const teamKey = normalizeTeamKey(name)
  if (!teamKey) {
    throw createError({ statusCode: 400, statusMessage: 'No se pudo generar team_key' })
  }

  const payload = {
    team_key: teamKey,
    name,
    code: normalizeOptionalText(body.code)?.toUpperCase() || null,
    country: normalizeOptionalText(body.country),
    logo_url: validateLogoUrl(normalizeOptionalText(body.logo_url)),
    api_team_id: typeof body.api_team_id === 'number' ? body.api_team_id : null,
    is_national: typeof body.is_national === 'boolean' ? body.is_national : null,
    source_provider: normalizeOptionalText(body.source_provider) || 'manual',
  }

  const { data, error } = await supabase
    .from('team_profiles')
    .upsert(payload, { onConflict: 'team_key' })
    .select('id, api_team_id, team_key, name, code, country, logo_url, is_national, source_provider, updated_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const updateHome: Record<string, string> = {}
  const updateAway: Record<string, string> = {}

  if (payload.code) {
    updateHome.home_team_code = payload.code
    updateAway.away_team_code = payload.code
  }

  if (payload.logo_url) {
    updateHome.home_team_logo_url = payload.logo_url
    updateAway.away_team_logo_url = payload.logo_url
  }

  if (Object.keys(updateHome).length > 0) {
    await supabase.from('matches').update(updateHome).eq('home_team', payload.name)
  }

  if (Object.keys(updateAway).length > 0) {
    await supabase.from('matches').update(updateAway).eq('away_team', payload.name)
  }

  return {
    ok: true,
    teamProfile: data,
  }
})
