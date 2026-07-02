import { createError, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'

type MatchStatus = 'pending' | 'in_progress' | 'finished'

type MatchUpdateBody = {
  home_score?: number | null
  away_score?: number | null
  home_extra_time_score?: number | null
  away_extra_time_score?: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
  status?: MatchStatus
  match_time?: string | null
  home_team?: string
  away_team?: string
  went_to_extra_time?: boolean
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

const parseMatchTime = (value: unknown): string => {
  const raw = String(value || '').trim()

  if (!raw) {
    throw createError({
      statusCode: 400,
      statusMessage: 'match_time invalido',
    })
  }

  const parsed = new Date(raw)

  if (Number.isNaN(parsed.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'match_time invalido',
    })
  }

  return parsed.toISOString()
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
  const hasHomeExtraTime = Object.prototype.hasOwnProperty.call(body, 'home_extra_time_score')
  const hasAwayExtraTime = Object.prototype.hasOwnProperty.call(body, 'away_extra_time_score')
  const hasHomePenalty = Object.prototype.hasOwnProperty.call(body, 'home_penalty_score')
  const hasAwayPenalty = Object.prototype.hasOwnProperty.call(body, 'away_penalty_score')
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status')
  const hasMatchTime = Object.prototype.hasOwnProperty.call(body, 'match_time')
  const hasHomeTeam = Object.prototype.hasOwnProperty.call(body, 'home_team')
  const hasAwayTeam = Object.prototype.hasOwnProperty.call(body, 'away_team')
  const hasWentToExtraTime = Object.prototype.hasOwnProperty.call(body, 'went_to_extra_time')

  if (!hasHome && !hasAway && !hasHomeExtraTime && !hasAwayExtraTime && !hasHomePenalty && !hasAwayPenalty && !hasStatus && !hasMatchTime && !hasHomeTeam && !hasAwayTeam && !hasWentToExtraTime) {
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

  if (hasHomeExtraTime !== hasAwayExtraTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Debes enviar home_extra_time_score y away_extra_time_score juntos',
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
  const clearPenaltyPatch = () => {
    patch.home_penalty_score = null
    patch.away_penalty_score = null
  }
  const clearExtraTimePatch = () => {
    patch.home_extra_time_score = null
    patch.away_extra_time_score = null
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

    const homePenaltyScore = parseScore(body.home_penalty_score, 'Penales local')
    const awayPenaltyScore = parseScore(body.away_penalty_score, 'Penales visitante')

    patch.home_penalty_score = homePenaltyScore
    patch.away_penalty_score = awayPenaltyScore
  }

  if (hasHomeExtraTime && hasAwayExtraTime) {
    patch.home_extra_time_score = parseScore(body.home_extra_time_score, 'Marcador TE local')
    patch.away_extra_time_score = parseScore(body.away_extra_time_score, 'Marcador TE visitante')
  }

  if (hasWentToExtraTime) {
    patch.went_to_extra_time = Boolean(body.went_to_extra_time)
  }

  if (hasStatus) {
    const status = String(body.status || '').trim() as MatchStatus

    if (!VALID_STATUS.has(status)) {
      throw createError({ statusCode: 400, statusMessage: 'status invalido' })
    }

    patch.status = status
  }

  if (hasMatchTime) {
    patch.match_time = parseMatchTime(body.match_time)
  }

  if (hasHomeTeam) {
    patch.home_team = String(body.home_team || '').trim()
  }

  if (hasAwayTeam) {
    patch.away_team = String(body.away_team || '').trim()
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
  const nextHomePenalty =
    (patch.home_penalty_score as number | null | undefined) !== undefined
      ? (patch.home_penalty_score as number | null)
      : (existing.home_penalty_score as number | null)
  const nextAwayPenalty =
    (patch.away_penalty_score as number | null | undefined) !== undefined
      ? (patch.away_penalty_score as number | null)
      : (existing.away_penalty_score as number | null)
  const nextHomeExtraTime =
    (patch.home_extra_time_score as number | null | undefined) !== undefined
      ? (patch.home_extra_time_score as number | null)
      : (existing.home_extra_time_score as number | null)
  const nextAwayExtraTime =
    (patch.away_extra_time_score as number | null | undefined) !== undefined
      ? (patch.away_extra_time_score as number | null)
      : (existing.away_extra_time_score as number | null)
  const nextWentToExtraTime =
    (patch.went_to_extra_time as boolean | undefined) !== undefined
      ? Boolean(patch.went_to_extra_time)
      : Boolean(existing.went_to_extra_time)
  const isKnockout = KNOCKOUT_STAGES.has(String(existing.stage || ''))

  const effectiveHomeScore =
    nextWentToExtraTime && nextHomeExtraTime !== null && nextAwayExtraTime !== null
      ? nextHomeExtraTime
      : nextHomeScore
  const effectiveAwayScore =
    nextWentToExtraTime && nextHomeExtraTime !== null && nextAwayExtraTime !== null
      ? nextAwayExtraTime
      : nextAwayScore

  if (nextStatus === 'pending') {
    patch.home_score = null
    patch.away_score = null
    patch.went_to_extra_time = false
    clearExtraTimePatch()
    clearPenaltyPatch()
  }

  if (nextStatus === 'in_progress') {
    patch.went_to_extra_time = false
    clearExtraTimePatch()
    clearPenaltyPatch()
  }

  if (nextStatus === 'finished') {
    if (nextHomeScore === null || nextAwayScore === null || nextHomeScore === undefined || nextAwayScore === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Para estado finished debes enviar ambos marcadores',
      })
    }

    if (isKnockout && nextWentToExtraTime) {
      if (nextHomeScore !== nextAwayScore) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Si hubo tiempo extra, el marcador regular debe quedar empatado',
        })
      }

      if (nextHomeExtraTime === null || nextAwayExtraTime === null || nextHomeExtraTime === undefined || nextAwayExtraTime === undefined) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Debes enviar el marcador final del tiempo extra',
        })
      }
    }

    if (isKnockout && effectiveHomeScore === effectiveAwayScore) {

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

    if (!isKnockout || !nextWentToExtraTime) {
      patch.went_to_extra_time = false
      clearExtraTimePatch()
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('matches')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }

  return {
    ok: true,
    item: updated,
  }
})
