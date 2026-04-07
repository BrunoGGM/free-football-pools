import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  formatTimeInTimeZone,
  formatUtcDate,
  normalizeApiFootballStage,
  normalizeApiFootballStatus,
} from '../../utils/apiFootball'
import { requireAdminAccess } from '../../utils/adminAccess'
import { resolveTeamCode } from '../../../utils/teamMeta'

type ApiFootballFixture = {
  fixture?: {
    id?: number
    date?: string
    timezone?: string
    venue?: {
      name?: string
    }
    status?: {
      short?: string
    }
  }
  league?: {
    round?: string
  }
  teams?: {
    home?: { name?: string }
    away?: { name?: string }
  }
  goals?: {
    home?: number | null
    away?: number | null
  }
}

type SyncBody = {
  quinielaId?: string
  leagueId?: number
  season?: number
  from?: string
  to?: string
  force?: boolean
}

const PROVIDER = 'api-football'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const apiKey = config.apiFootballKey as string | undefined

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Falta API_FOOTBALL_KEY en variables de entorno',
    })
  }

  const body = (await readBody(event).catch(() => ({}))) as SyncBody
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireAdminAccess(event, supabase)

  const defaultLeague = Number(config.apiFootballLeagueId || 1)
  const defaultSeason = Number(config.apiFootballSeason || new Date().getUTCFullYear())
  const dailyBudget = Math.max(1, Number(config.apiFootballDailyBudget || 100))
  const minSyncMinutes = Math.max(1, Number(config.apiFootballMinSyncMinutes || 15))

  const now = new Date()
  const today = formatUtcDate(now)
  const from = body.from || formatUtcDate(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))
  const to = body.to || formatUtcDate(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000))
  const leagueId = Number(body.leagueId || defaultLeague)
  const season = Number(body.season || defaultSeason)
  const force = Boolean(body.force)

  const { data: usageRow, error: usageReadError } = await supabase
    .from('api_provider_usage')
    .select('requests_used')
    .eq('provider', PROVIDER)
    .eq('usage_date', today)
    .maybeSingle()

  if (usageReadError) {
    throw createError({ statusCode: 500, statusMessage: usageReadError.message })
  }

  const requestsUsedToday = Number(usageRow?.requests_used || 0)

  if (!force && requestsUsedToday >= dailyBudget) {
    throw createError({
      statusCode: 429,
      statusMessage: `Presupuesto diario agotado (${requestsUsedToday}/${dailyBudget})`,
    })
  }

  const { data: stateRow, error: stateReadError } = await supabase
    .from('api_provider_sync_state')
    .select('last_synced_at')
    .eq('provider', PROVIDER)
    .maybeSingle()

  if (stateReadError) {
    throw createError({ statusCode: 500, statusMessage: stateReadError.message })
  }

  if (!force && stateRow?.last_synced_at) {
    const lastSyncAt = new Date(stateRow.last_synced_at)
    const nextSyncAt = new Date(lastSyncAt.getTime() + minSyncMinutes * 60 * 1000)

    if (Date.now() < nextSyncAt.getTime()) {
      return {
        ok: true,
        skipped: true,
        reason: `Cooldown activo. Proximo sync recomendado: ${nextSyncAt.toISOString()}`,
        requestsUsedToday,
        dailyBudget,
        leagueId,
        season,
        from,
        to,
      }
    }
  }

  const apiUrl = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&from=${from}&to=${to}&timezone=UTC`

  const response = await $fetch<{
    response?: ApiFootballFixture[]
    results?: number
  }>(apiUrl, {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey,
    },
  }).catch(async (err: any) => {
    await supabase.from('api_provider_sync_state').upsert({
      provider: PROVIDER,
      last_status: 'error',
      last_error: err?.data?.message || err?.message || 'Error consultando API-FOOTBALL',
      updated_at: new Date().toISOString(),
    })

    throw createError({ statusCode: 502, statusMessage: 'Error consultando API-FOOTBALL' })
  })

  const fixtures = Array.isArray(response?.response) ? response.response : []

  const rowsToUpsert: Array<{
    api_fixture_id: number
    home_team: string
    away_team: string
    home_team_code: string | null
    away_team_code: string | null
    home_score: number | null
    away_score: number | null
    status: 'pending' | 'in_progress' | 'finished'
    match_time: string
    stage: string
    venue: string | null
    source_time: string | null
    source_timezone: string
  }> = []

  let skippedUnknownStage = 0

  for (const fixture of fixtures) {
    const fixtureId = Number(fixture.fixture?.id || 0)
    const homeTeam = (fixture.teams?.home?.name || '').trim()
    const awayTeam = (fixture.teams?.away?.name || '').trim()
    const matchTime = fixture.fixture?.date
    const stage = normalizeApiFootballStage(fixture.league?.round)
    const venue = (fixture.fixture?.venue?.name || '').trim() || null
    const sourceTime = matchTime ? formatTimeInTimeZone(matchTime, 'America/New_York') : null

    if (!fixtureId || !homeTeam || !awayTeam || !matchTime || !stage) {
      skippedUnknownStage += 1
      continue
    }

    rowsToUpsert.push({
      api_fixture_id: fixtureId,
      home_team: homeTeam,
      away_team: awayTeam,
      home_team_code: resolveTeamCode(homeTeam),
      away_team_code: resolveTeamCode(awayTeam),
      home_score: fixture.goals?.home ?? null,
      away_score: fixture.goals?.away ?? null,
      status: normalizeApiFootballStatus(fixture.fixture?.status?.short),
      match_time: matchTime,
      stage,
      venue,
      source_time: sourceTime,
      source_timezone: 'America/New_York',
    })
  }

  if (rowsToUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('matches')
      .upsert(rowsToUpsert, { onConflict: 'stage,match_time,home_team,away_team' })

    if (upsertError) {
      throw createError({ statusCode: 500, statusMessage: upsertError.message })
    }
  }

  const newUsedCount = requestsUsedToday + 1

  const { error: usageWriteError } = await supabase.from('api_provider_usage').upsert({
    provider: PROVIDER,
    usage_date: today,
    requests_used: newUsedCount,
    updated_at: new Date().toISOString(),
  })

  if (usageWriteError) {
    throw createError({ statusCode: 500, statusMessage: usageWriteError.message })
  }

  const { error: stateWriteError } = await supabase.from('api_provider_sync_state').upsert({
    provider: PROVIDER,
    last_synced_at: new Date().toISOString(),
    last_status: 'ok',
    last_error: null,
    last_response_count: Number(response?.results || fixtures.length || 0),
    updated_at: new Date().toISOString(),
  })

  if (stateWriteError) {
    throw createError({ statusCode: 500, statusMessage: stateWriteError.message })
  }

  return {
    ok: true,
    skipped: false,
    requestsUsedToday: newUsedCount,
    dailyBudget,
    leagueId,
    season,
    from,
    to,
    pulledFromApi: fixtures.length,
    savedMatches: rowsToUpsert.length,
    skippedUnknownStage,
  }
})
