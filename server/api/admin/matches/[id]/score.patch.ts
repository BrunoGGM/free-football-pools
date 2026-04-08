import { createError, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'

type MatchStatus = 'pending' | 'in_progress' | 'finished'

type MatchUpdateBody = {
  home_score?: number | null
  away_score?: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
  status?: MatchStatus
}

const VALID_STATUS = new Set<MatchStatus>(['pending', 'in_progress', 'finished'])
const KNOCKOUT_STAGES = new Set([
  'round_32',
  'round_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
])

const parseScore = (value: unknown, label = 'Marcador'): number | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} invalido (entero >= 0 o null)`,
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
  const hasHomePenalty = Object.prototype.hasOwnProperty.call(body, 'home_penalty_score')
  const hasAwayPenalty = Object.prototype.hasOwnProperty.call(body, 'away_penalty_score')
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status')

  if (!hasHome && !hasAway && !hasHomePenalty && !hasAwayPenalty && !hasStatus) {
    throw createError({ statusCode: 400, statusMessage: 'No hay campos para actualizar' })
  }

  if (hasHome !== hasAway) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Debes enviar home_score y away_score juntos',
    })
  }

  if (hasHomePenalty !== hasAwayPenalty) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Debes enviar home_penalty_score y away_penalty_score juntos',
    })
  }

  const { data: existing, error: existingError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  if (!existing?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Partido no encontrado' })
  }

  const patch: Record<string, unknown> = {}
  const supportsPenalties =
    Object.prototype.hasOwnProperty.call(existing, 'home_penalty_score') &&
    Object.prototype.hasOwnProperty.call(existing, 'away_penalty_score')

  const clearPenaltyPatch = () => {
    if (!supportsPenalties) {
      return
    }

    patch.home_penalty_score = null
    patch.away_penalty_score = null
  }

  if (hasHome && hasAway) {
    const homeScore = parseScore(body.home_score, 'Marcador local')
    const awayScore = parseScore(body.away_score, 'Marcador visitante')

    patch.home_score = homeScore
    patch.away_score = awayScore

    if (!hasStatus) {
      patch.status = homeScore === null || awayScore === null ? 'pending' : 'finished'
    }
  }

  if (hasHomePenalty && hasAwayPenalty) {
    if (!supportsPenalties) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tu base no tiene soporte de penales aun. Aplica la migracion 0028_knockout_penalties_progression.sql',
      })
    }

    patch.home_penalty_score = parseScore(body.home_penalty_score, 'Penales local')
    patch.away_penalty_score = parseScore(body.away_penalty_score, 'Penales visitante')
  }

  if (hasStatus) {
    const status = String(body.status || '').trim() as MatchStatus

    if (!VALID_STATUS.has(status)) {
      throw createError({ statusCode: 400, statusMessage: 'status invalido' })
    }

    patch.status = status
  }

  const nextStatus = (patch.status as MatchStatus | undefined) || (existing.status as MatchStatus)
  const nextHomeScore =
    (patch.home_score as number | null | undefined) !== undefined
      ? (patch.home_score as number | null)
      : (existing.home_score as number | null)
  const nextAwayScore =
    (patch.away_score as number | null | undefined) !== undefined
      ? (patch.away_score as number | null)
      : (existing.away_score as number | null)
  const nextHomePenalty = supportsPenalties
    ? (patch.home_penalty_score as number | null | undefined) !== undefined
      ? (patch.home_penalty_score as number | null)
      : (existing.home_penalty_score as number | null)
    : null
  const nextAwayPenalty = supportsPenalties
    ? (patch.away_penalty_score as number | null | undefined) !== undefined
      ? (patch.away_penalty_score as number | null)
      : (existing.away_penalty_score as number | null)
    : null
  const isKnockout = KNOCKOUT_STAGES.has(String(existing.stage || ''))

  if (nextStatus === 'pending') {
    patch.home_score = null
    patch.away_score = null
    clearPenaltyPatch()
  }

  if (nextStatus === 'in_progress') {
    clearPenaltyPatch()
  }

  if (nextStatus === 'finished') {
    if (nextHomeScore === null || nextAwayScore === null || nextHomeScore === undefined || nextAwayScore === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Para estado finished debes enviar ambos marcadores',
      })
    }

    if (isKnockout && nextHomeScore === nextAwayScore) {
      if (!supportsPenalties) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Tu base no tiene soporte de penales aun. Aplica la migracion 0028_knockout_penalties_progression.sql',
        })
      }

      if (nextHomePenalty === null || nextAwayPenalty === null || nextHomePenalty === undefined || nextAwayPenalty === undefined) {
        throw createError({
          statusCode: 400,
          statusMessage: 'En eliminatoria, un empate requiere marcador de penales',
        })
      }

      if (nextHomePenalty === nextAwayPenalty) {
        throw createError({
          statusCode: 400,
          statusMessage: 'En penales no puede haber empate',
        })
      }
    } else {
      clearPenaltyPatch()
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('matches')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (updateError) {
    if (updateError.code === '42703') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tu base no tiene soporte de penales aun. Aplica la migracion 0028_knockout_penalties_progression.sql',
      })
    }

    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }

  return {
    ok: true,
    item: updated,
  }
})
