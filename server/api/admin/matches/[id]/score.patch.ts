import { createError, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'

type MatchStatus = 'pending' | 'in_progress' | 'finished'

type MatchUpdateBody = {
  home_score?: number | null
  away_score?: number | null
  status?: MatchStatus
}

const VALID_STATUS = new Set<MatchStatus>(['pending', 'in_progress', 'finished'])

const parseScore = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Marcador invalido (entero >= 0 o null)',
    })
  }

  return parsed
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireAdminAccess(event, supabase)

  const id = getRouterParam(event, 'id')?.trim()

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id de partido requerido' })
  }

  const body = (await readBody(event).catch(() => ({}))) as MatchUpdateBody

  const hasHome = Object.prototype.hasOwnProperty.call(body, 'home_score')
  const hasAway = Object.prototype.hasOwnProperty.call(body, 'away_score')
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status')

  if (!hasHome && !hasAway && !hasStatus) {
    throw createError({ statusCode: 400, statusMessage: 'No hay campos para actualizar' })
  }

  if (hasHome !== hasAway) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Debes enviar home_score y away_score juntos',
    })
  }

  const { data: existing, error: existingError } = await supabase
    .from('matches')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  if (!existing?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Partido no encontrado' })
  }

  const patch: Record<string, unknown> = {}

  if (hasHome && hasAway) {
    const homeScore = parseScore(body.home_score)
    const awayScore = parseScore(body.away_score)

    patch.home_score = homeScore
    patch.away_score = awayScore

    if (!hasStatus) {
      patch.status = homeScore === null || awayScore === null ? 'pending' : 'finished'
    }
  }

  if (hasStatus) {
    const status = String(body.status || '').trim() as MatchStatus

    if (!VALID_STATUS.has(status)) {
      throw createError({ statusCode: 400, statusMessage: 'status invalido' })
    }

    patch.status = status
  }

  if (patch.status === 'pending') {
    patch.home_score = null
    patch.away_score = null
  }

  if (patch.status === 'finished') {
    const nextHome = patch.home_score as number | null | undefined
    const nextAway = patch.away_score as number | null | undefined

    if (nextHome === null || nextAway === null || nextHome === undefined || nextAway === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Para estado finished debes enviar ambos marcadores',
      })
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('matches')
    .update(patch)
    .eq('id', id)
    .select('id, home_team, away_team, home_score, away_score, status, stage, updated_at')
    .maybeSingle()

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }

  return {
    ok: true,
    item: updated,
  }
})
