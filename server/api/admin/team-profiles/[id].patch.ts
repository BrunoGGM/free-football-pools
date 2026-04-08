import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../../utils/adminAccess'
import { normalizeTeamKey } from '../../../../utils/teamMeta'

type UpdateTeamProfileBody = {
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

function parseLogoUrl(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const normalized = normalizeOptionalText(value)
  if (!normalized) {
    return null
  }

  try {
    const url = new URL(normalized)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Protocolo invalido')
    }
    return normalized
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'logo_url invalido' })
  }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireGlobalAdminAccess(event, supabase)

  const profileId = getRouterParam(event, 'id')
  if (!profileId) {
    throw createError({ statusCode: 400, statusMessage: 'id requerido' })
  }

  const { data: existing, error: existingError } = await supabase
    .from('team_profiles')
    .select('id, name, code, logo_url')
    .eq('id', profileId)
    .maybeSingle()

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Equipo no encontrado' })
  }

  const body = (await readBody(event).catch(() => ({}))) as UpdateTeamProfileBody
  const payload: Record<string, any> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (name.length < 2) {
      throw createError({ statusCode: 400, statusMessage: 'Nombre invalido (minimo 2 caracteres)' })
    }

    payload.name = name
    payload.team_key = normalizeTeamKey(name)
  }

  if (body.code !== undefined) {
    payload.code = normalizeOptionalText(body.code)?.toUpperCase() || null
  }

  if (body.country !== undefined) {
    payload.country = normalizeOptionalText(body.country)
  }

  if (body.api_team_id !== undefined) {
    payload.api_team_id = typeof body.api_team_id === 'number' ? body.api_team_id : null
  }

  if (body.is_national !== undefined) {
    payload.is_national = typeof body.is_national === 'boolean' ? body.is_national : null
  }

  if (body.source_provider !== undefined) {
    payload.source_provider = normalizeOptionalText(body.source_provider) || 'manual'
  }

  const logoValue = parseLogoUrl(body.logo_url)
  if (logoValue !== undefined) {
    payload.logo_url = logoValue
  }

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No hay campos para actualizar' })
  }

  const { data, error } = await supabase
    .from('team_profiles')
    .update(payload)
    .eq('id', profileId)
    .select('id, api_team_id, team_key, name, code, country, logo_url, is_national, source_provider, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Ya existe un equipo con ese nombre' })
    }
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const finalName = String(data.name || existing.name)
  const oldName = String(existing.name)

  if (finalName !== oldName) {
    await supabase.from('matches').update({ home_team: finalName }).eq('home_team', oldName)
    await supabase.from('matches').update({ away_team: finalName }).eq('away_team', oldName)
  }

  const updateHome: Record<string, string | null> = {
    home_team_code: data.code || null,
    home_team_logo_url: data.logo_url || null,
  }
  const updateAway: Record<string, string | null> = {
    away_team_code: data.code || null,
    away_team_logo_url: data.logo_url || null,
  }

  await supabase.from('matches').update(updateHome).eq('home_team', finalName)
  await supabase.from('matches').update(updateAway).eq('away_team', finalName)

  return {
    ok: true,
    teamProfile: data,
  }
})
