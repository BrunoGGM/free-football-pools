import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../utils/adminAccess'
import { normalizeTeamKey, resolveTeamCode } from '../../../utils/teamMeta'

type SyncTeamsBody = {
  force?: boolean
}

type ApiFootballTeamCandidate = {
  team?: {
    id?: number
    name?: string
    code?: string
    country?: string
    national?: boolean
    logo?: string
  }
}

const PROVIDER = 'api-football'
const DEFAULT_DELAY_MS = 160

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function splitSearchTerms(teamName: string): string[] {
  const set = new Set<string>()
  const raw = teamName.trim()

  if (raw) {
    set.add(raw)
  }

  for (const piece of raw.split('/')) {
    const value = piece.trim()
    if (value) {
      set.add(value)
    }
  }

  return [...set]
}

function scoreCandidate(targetName: string, candidate: ApiFootballTeamCandidate): number {
  const team = candidate.team
  const candidateName = (team?.name || '').trim()

  if (!candidateName) {
    return -1
  }

  const targetKey = normalizeTeamKey(targetName)
  const candidateKey = normalizeTeamKey(candidateName)

  let score = 0

  if (candidateKey === targetKey) {
    score += 120
  }

  if (targetKey.includes(candidateKey) || candidateKey.includes(targetKey)) {
    score += 40
  }

  if (team?.national) {
    score += 20
  }

  if (team?.logo) {
    score += 10
  }

  if (team?.code) {
    score += 5
  }

  return score
}

function pickBestCandidate(
  teamName: string,
  candidates: ApiFootballTeamCandidate[],
): ApiFootballTeamCandidate | null {
  let best: ApiFootballTeamCandidate | null = null
  let bestScore = -1

  for (const candidate of candidates) {
    const score = scoreCandidate(teamName, candidate)

    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const apiKey = config.apiFootballKey as string | undefined

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Falta API_FOOTBALL_KEY en variables de entorno',
    })
  }

  const body = (await readBody(event).catch(() => ({}))) as SyncTeamsBody
  const force = Boolean(body.force)

  const supabase = serverSupabaseServiceRole<any>(event)
  await requireAdminAccess(event, supabase)

  const { data: matchesRows, error: matchesError } = await supabase
    .from('matches')
    .select('home_team, away_team')

  if (matchesError) {
    throw createError({ statusCode: 500, statusMessage: matchesError.message })
  }

  const allTeamNames = new Set<string>()

  for (const row of matchesRows || []) {
    const homeTeam = String(row?.home_team || '').trim()
    const awayTeam = String(row?.away_team || '').trim()

    if (homeTeam) {
      allTeamNames.add(homeTeam)
    }

    if (awayTeam) {
      allTeamNames.add(awayTeam)
    }
  }

  const teamNames = [...allTeamNames]

  if (teamNames.length === 0) {
    return {
      ok: true,
      searchedTeams: 0,
      syncedProfiles: 0,
      skippedCached: 0,
      unresolvedTeams: [],
      updatedMatchesHome: 0,
      updatedMatchesAway: 0,
    }
  }

  const { data: existingProfiles, error: existingError } = await supabase
    .from('team_profiles')
    .select('team_key, logo_url, api_team_id, code')

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  const existingByKey = new Map<
    string,
    { logo_url: string | null; api_team_id: number | null; code: string | null }
  >()

  for (const row of existingProfiles || []) {
    existingByKey.set(String(row.team_key), {
      logo_url: row.logo_url || null,
      api_team_id: row.api_team_id ?? null,
      code: row.code || null,
    })
  }

  const upsertProfiles: Array<{
    team_key: string
    api_team_id: number | null
    name: string
    code: string | null
    country: string | null
    logo_url: string | null
    is_national: boolean | null
    source_provider: string
  }> = []

  const resolvedTeams: Array<{
    name: string
    code: string | null
    logoUrl: string | null
  }> = []

  const unresolvedTeams: string[] = []

  let skippedCached = 0
  let requestsExecuted = 0

  const delayMs = Math.max(0, Number(config.apiFootballMediaDelayMs || DEFAULT_DELAY_MS))

  for (const teamName of teamNames) {
    const teamKey = normalizeTeamKey(teamName)

    if (!teamKey) {
      continue
    }

    const cached = existingByKey.get(teamKey)
    if (!force && cached?.logo_url) {
      skippedCached += 1
      resolvedTeams.push({
        name: teamName,
        code: cached.code || resolveTeamCode(teamName),
        logoUrl: cached.logo_url,
      })
      continue
    }

    const terms = splitSearchTerms(teamName)
    const candidates: ApiFootballTeamCandidate[] = []

    for (const term of terms) {
      const apiUrl = `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(term)}`

      const response = await $fetch<{ response?: ApiFootballTeamCandidate[] }>(apiUrl, {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey,
        },
      }).catch(() => ({ response: [] }))

      requestsExecuted += 1

      for (const item of response.response || []) {
        candidates.push(item)
      }

      if (delayMs > 0) {
        await wait(delayMs)
      }
    }

    const best = pickBestCandidate(teamName, candidates)

    if (!best?.team?.name) {
      unresolvedTeams.push(teamName)
      continue
    }

    const code = (best.team.code || '').trim() || resolveTeamCode(teamName)
    const logoUrl = (best.team.logo || '').trim() || null

    upsertProfiles.push({
      team_key: teamKey,
      api_team_id: best.team.id ?? null,
      name: teamName,
      code: code || null,
      country: (best.team.country || '').trim() || null,
      logo_url: logoUrl,
      is_national: best.team.national ?? null,
      source_provider: PROVIDER,
    })

    resolvedTeams.push({
      name: teamName,
      code: code || null,
      logoUrl,
    })
  }

  if (upsertProfiles.length > 0) {
    const { error: upsertError } = await supabase
      .from('team_profiles')
      .upsert(upsertProfiles, { onConflict: 'team_key' })

    if (upsertError) {
      throw createError({ statusCode: 500, statusMessage: upsertError.message })
    }
  }

  let updatedMatchesHome = 0
  let updatedMatchesAway = 0

  for (const team of resolvedTeams) {
    const updateHome: Record<string, string> = {}
    const updateAway: Record<string, string> = {}

    if (team.code) {
      updateHome.home_team_code = team.code
      updateAway.away_team_code = team.code
    }

    if (team.logoUrl) {
      updateHome.home_team_logo_url = team.logoUrl
      updateAway.away_team_logo_url = team.logoUrl
    }

    if (Object.keys(updateHome).length > 0) {
      const { error: homeError } = await supabase
        .from('matches')
        .update(updateHome)
        .eq('home_team', team.name)

      if (homeError) {
        throw createError({ statusCode: 500, statusMessage: homeError.message })
      }

      updatedMatchesHome += 1
    }

    if (Object.keys(updateAway).length > 0) {
      const { error: awayError } = await supabase
        .from('matches')
        .update(updateAway)
        .eq('away_team', team.name)

      if (awayError) {
        throw createError({ statusCode: 500, statusMessage: awayError.message })
      }

      updatedMatchesAway += 1
    }
  }

  return {
    ok: true,
    searchedTeams: teamNames.length,
    syncedProfiles: upsertProfiles.length,
    skippedCached,
    requestsExecuted,
    unresolvedTeams,
    updatedMatchesHome,
    updatedMatchesAway,
  }
})
