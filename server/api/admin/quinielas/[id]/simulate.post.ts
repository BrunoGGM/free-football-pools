import { createError, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../../../utils/adminAccess'
import { normalizeTeamKey, resolveTeamCode } from '../../../../../utils/teamMeta'
import {
  computeGroupRankings,
  getDefaultSeedPairByMatchNumber,
  isRound32SeedToken,
  resolveRound32SeedToken,
  KNOCKOUT_STAGE_FLOW,
  type GroupOverrideRow,
} from '../../../../utils/bracketEngine'
import {
  getSimulationSegmentLabel,
  getStagesBySegment,
  isSimulationSegment,
  type SimulationSegment,
} from '../../../../utils/simulationSegments'

type SimulateBody = {
  segment?: string
  simulate_scores?: boolean
  simulate_population?: boolean
  test_users_count?: number | string
  reset_test_data?: boolean
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max)
}

const randomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (items.length === 0) {
    return []
  }

  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }

  return chunks
}

const upsertPredictionsInChunks = async (
  supabase: any,
  predictions: Array<{
    user_id: string
    quiniela_id: string
    match_id: string
    home_score: number
    away_score: number
    is_test_record: boolean
  }>,
  chunkSize = 500,
) => {
  for (const chunk of chunkArray(predictions, chunkSize)) {
    const { error } = await supabase
      .from('predictions')
      .upsert(chunk, {
        onConflict: 'user_id,quiniela_id,match_id',
      })

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }
  }
}

const STAGE_PRIORITY: Record<string, number> = {
  group_a: 1,
  group_b: 2,
  group_c: 3,
  group_d: 4,
  group_e: 5,
  group_f: 6,
  group_g: 7,
  group_h: 8,
  group_i: 9,
  group_j: 10,
  group_k: 11,
  group_l: 12,
  round_32: 13,
  round_16: 14,
  quarter_final: 15,
  semi_final: 16,
  third_place: 17,
  final: 18,
}

const KNOCKOUT_STAGES_NO_DRAW = new Set([
  'round_32',
  'round_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
])

const loadGroupOverrides = async (supabase: any, quinielaId: string): Promise<GroupOverrideRow[]> => {
  const { data, error } = await supabase
    .from('quiniela_group_overrides')
    .select('group_code, position, team_name, team_code, team_logo_url')
    .eq('quiniela_id', quinielaId)

  if (error?.code === '42P01') {
    return []
  }

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data || []) as GroupOverrideRow[]
}

const resolveRound32Participants = async (supabase: any, quinielaId: string) => {
  const groupStages = getStagesBySegment('group_stage')

  const { data: groupMatches, error: groupMatchesError } = await supabase
    .from('matches')
    .select('stage, home_team, away_team, home_score, away_score, status')
    .in('stage', groupStages)

  if (groupMatchesError) {
    throw createError({ statusCode: 500, statusMessage: groupMatchesError.message })
  }

  const { data: round32Matches, error: round32MatchesError } = await supabase
    .from('matches')
    .select('*')
    .eq('stage', 'round_32')

  if (round32MatchesError) {
    throw createError({ statusCode: 500, statusMessage: round32MatchesError.message })
  }

  const overrides = await loadGroupOverrides(supabase, quinielaId)
  const { rankedByGroup, thirdPlaceRows } = computeGroupRankings(groupMatches || [], overrides)

  const thirdPlaceUsedGroups = new Set<string>()

  const candidateTeamKeys = new Set<string>()
  for (const row of rankedByGroup.values()) {
    for (const team of row) {
      const key = normalizeTeamKey(team.team)
      if (key) {
        candidateTeamKeys.add(key)
      }
    }
  }

  const teamProfilesByKey = new Map<string, { code: string | null; logo_url: string | null }>()

  if (candidateTeamKeys.size > 0) {
    const keys = [...candidateTeamKeys]
    const { data: teamProfiles, error: teamProfilesError } = await supabase
      .from('team_profiles')
      .select('team_key, code, logo_url')
      .in('team_key', keys)

    if (teamProfilesError && teamProfilesError.code !== '42P01') {
      throw createError({ statusCode: 500, statusMessage: teamProfilesError.message })
    }

    for (const team of teamProfiles || []) {
      const teamKey = String(team.team_key || '')
      if (!teamKey) {
        continue
      }

      teamProfilesByKey.set(teamKey, {
        code: team.code ? String(team.code) : null,
        logo_url: team.logo_url ? String(team.logo_url) : null,
      })
    }
  }

  const sortedRound32 = [...(round32Matches || [])].sort((a: any, b: any) => {
    const bracketDiff = Number(a.bracket_match_no || 0) - Number(b.bracket_match_no || 0)

    if (!Number.isNaN(bracketDiff) && bracketDiff !== 0) {
      return bracketDiff
    }

    const timeDiff =
      new Date(String(a.match_time || '')).getTime()
      - new Date(String(b.match_time || '')).getTime()

    if (!Number.isNaN(timeDiff) && timeDiff !== 0) {
      return timeDiff
    }

    const fixtureDiff = Number(a.api_fixture_id || 0) - Number(b.api_fixture_id || 0)

    if (fixtureDiff !== 0) {
      return fixtureDiff
    }

    return String(a.id || '').localeCompare(String(b.id || ''))
  })

  let resolvedSlots = 0
  let unresolvedSlots = 0

  for (const match of sortedRound32) {
    const patch: Record<string, unknown> = {}
    const supportsSeedColumns =
      Object.prototype.hasOwnProperty.call(match, 'home_seed_token')
      && Object.prototype.hasOwnProperty.call(match, 'away_seed_token')

    const applyTeam = (
      side: 'home' | 'away',
      seedToken: string,
      currentTeam: string,
      currentCode: string | null,
      currentLogo: string | null,
    ) => {
      if (!isRound32SeedToken(seedToken)) {
        return
      }

      const resolvedTeam = resolveRound32SeedToken(
        seedToken,
        rankedByGroup,
        thirdPlaceRows,
        thirdPlaceUsedGroups,
      )

      if (!resolvedTeam) {
        unresolvedSlots += 1
        return
      }

      const teamKey = normalizeTeamKey(resolvedTeam)
      const profile = teamProfilesByKey.get(teamKey)
      const resolvedCode = profile?.code || resolveTeamCode(resolvedTeam) || currentCode || null
      const resolvedLogo = profile?.logo_url || currentLogo || null

      if (side === 'home') {
        patch.home_team = resolvedTeam
        patch.home_team_code = resolvedCode
        patch.home_team_logo_url = resolvedLogo

        if (supportsSeedColumns) {
          patch.home_seed_token = seedToken
        }
      } else {
        patch.away_team = resolvedTeam
        patch.away_team_code = resolvedCode
        patch.away_team_logo_url = resolvedLogo

        if (supportsSeedColumns) {
          patch.away_seed_token = seedToken
        }
      }

      resolvedSlots += 1
    }

    applyTeam(
      'home',
      String(match.home_seed_token || match.home_team || ''),
      String(match.home_team || ''),
      match.home_team_code ? String(match.home_team_code) : null,
      match.home_team_logo_url ? String(match.home_team_logo_url) : null,
    )

    applyTeam(
      'away',
      String(match.away_seed_token || match.away_team || ''),
      String(match.away_team || ''),
      match.away_team_code ? String(match.away_team_code) : null,
      match.away_team_logo_url ? String(match.away_team_logo_url) : null,
    )

    if (Object.keys(patch).length === 0) {
      continue
    }

    const { error: patchError } = await supabase
      .from('matches')
      .update(patch)
      .eq('id', match.id)

    if (patchError) {
      throw createError({ statusCode: 500, statusMessage: patchError.message })
    }
  }

  return {
    resolvedSlots,
    unresolvedSlots,
  }
}

const getTestUserPrefix = (quinielaId: string) => {
  return `sim_${quinielaId.slice(0, 4)}_`
}

const loadReusableTestUserIds = async (
  supabase: any,
  quinielaId: string,
  limit: number,
): Promise<string[]> => {
  const prefix = getTestUserPrefix(quinielaId)

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_test_user', true)
    .ilike('username', `${prefix}%`)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data || []).map((item: any) => String(item.id))
}

const normalizeUsersCount = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return 12
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'test_users_count invalido (entero >= 1)' })
  }

  return clamp(Math.floor(parsed), 1, 120)
}

const clearTestData = async (supabase: any, quinielaId: string) => {
  const { error: predictionsDeleteError } = await supabase
    .from('predictions')
    .delete()
    .eq('quiniela_id', quinielaId)
    .eq('is_test_record', true)

  if (predictionsDeleteError) {
    throw createError({ statusCode: 500, statusMessage: predictionsDeleteError.message })
  }

  const { error: membersDeleteError } = await supabase
    .from('quiniela_members')
    .delete()
    .eq('quiniela_id', quinielaId)
    .eq('is_test_record', true)

  if (membersDeleteError) {
    throw createError({ statusCode: 500, statusMessage: membersDeleteError.message })
  }

  const { error: recalcError } = await supabase.rpc('recalculate_quiniela_scoring', {
    p_quiniela_id: quinielaId,
  })

  if (recalcError) {
    throw createError({ statusCode: 500, statusMessage: recalcError.message })
  }
}

const sortMatchesByStageTime = (items: any[]) => {
  return [...items].sort((a, b) => {
    const timeDiff =
      new Date(String(a.match_time || '')).getTime()
      - new Date(String(b.match_time || '')).getTime()

    if (!Number.isNaN(timeDiff) && timeDiff !== 0) {
      return timeDiff
    }

    const fixtureDiff = Number(a.api_fixture_id || 0) - Number(b.api_fixture_id || 0)

    if (fixtureDiff !== 0) {
      return fixtureDiff
    }

    return String(a.id || '').localeCompare(String(b.id || ''))
  })
}

const getKnockoutStartStageFromStages = (stages: string[]) => {
  for (const stage of KNOCKOUT_STAGE_FLOW) {
    if (stages.includes(stage)) {
      return stage
    }
  }

  return null
}

const resetDownstreamKnockoutSeeds = async (
  supabase: any,
  stages: string[],
) => {
  const startStage = getKnockoutStartStageFromStages(stages)

  if (!startStage) {
    return {
      downstreamMatchesReset: 0,
    }
  }

  const startIndex = KNOCKOUT_STAGE_FLOW.indexOf(startStage)

  if (startIndex < 0) {
    return {
      downstreamMatchesReset: 0,
    }
  }

  let downstreamMatchesReset = 0

  for (let i = startIndex + 1; i < KNOCKOUT_STAGE_FLOW.length; i += 1) {
    const stage = KNOCKOUT_STAGE_FLOW[i]

    if (!stage) {
      continue
    }

    const { data: rows, error: rowsError } = await supabase
      .from('matches')
      .select('*')
      .eq('stage', stage)

    if (rowsError) {
      throw createError({ statusCode: 500, statusMessage: rowsError.message })
    }

    const sortedRows = sortMatchesByStageTime(rows || [])
    const patchRows = sortedRows
      .map((row: any) => {
        const supportsSeedColumns =
          Object.prototype.hasOwnProperty.call(row, 'home_seed_token')
          && Object.prototype.hasOwnProperty.call(row, 'away_seed_token')

        const bracketMatchNo = Number(row.bracket_match_no || 0)
        const mapped = Number.isInteger(bracketMatchNo)
          ? getDefaultSeedPairByMatchNumber(bracketMatchNo)
          : null

        const homeSeed = String(row.home_seed_token || mapped?.home || '').trim()
        const awaySeed = String(row.away_seed_token || mapped?.away || '').trim()

        if (!homeSeed || !awaySeed) {
          return null
        }

        const patchRow: Record<string, unknown> = {
          id: String(row.id),
          home_team: homeSeed,
          away_team: awaySeed,
          home_team_code: null,
          away_team_code: null,
          home_team_logo_url: null,
          away_team_logo_url: null,
          home_score: null,
          away_score: null,
          home_penalty_score: null,
          away_penalty_score: null,
          status: 'pending',
        }

        if (supportsSeedColumns) {
          patchRow.home_seed_token = homeSeed
          patchRow.away_seed_token = awaySeed
        }

        return patchRow
      })
      .filter(Boolean)

    if (patchRows.length === 0) {
      continue
    }

    for (const row of patchRows) {
      const matchId = String((row as any).id || '')

      if (!matchId) {
        continue
      }

      const {
        id: _ignored,
        ...patch
      } = row as Record<string, unknown>

      const { error: patchError } = await supabase
        .from('matches')
        .update(patch)
        .eq('id', matchId)

      if (patchError) {
        throw createError({ statusCode: 500, statusMessage: patchError.message })
      }
    }

    downstreamMatchesReset += patchRows.length
  }

  return {
    downstreamMatchesReset,
  }
}

const ensureNoActiveScoreSimulationFromAnotherQuiniela = async (
  supabase: any,
  quinielaId: string,
) => {
  const { data, error } = await supabase
    .from('simulation_match_snapshots')
    .select('quiniela_id')
    .neq('quiniela_id', quinielaId)
    .limit(1)

  if (error?.code === '42P01') {
    return
  }

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if ((data || []).length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Hay una simulacion de marcadores activa en otra quiniela. Limpiala primero para evitar sobrescribir partidos globales.',
    })
  }
}

const captureGlobalMatchesSnapshotIfMissing = async (
  supabase: any,
  quinielaId: string,
) => {
  const { data: existing, error: existingError } = await supabase
    .from('simulation_match_snapshots')
    .select('match_id')
    .eq('quiniela_id', quinielaId)
    .limit(1)

  if (existingError?.code === '42P01') {
    return {
      captured: false,
      matches: 0,
    }
  }

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  if ((existing || []).length > 0) {
    return {
      captured: false,
      matches: 0,
    }
  }

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('*')

  if (matchesError) {
    throw createError({ statusCode: 500, statusMessage: matchesError.message })
  }

  const snapshotRows = (matches || []).map((match: any) => {
    const row: Record<string, unknown> = {
      quiniela_id: quinielaId,
      match_id: String(match.id),
      home_team: String(match.home_team || ''),
      away_team: String(match.away_team || ''),
      home_team_code: match.home_team_code ? String(match.home_team_code) : null,
      away_team_code: match.away_team_code ? String(match.away_team_code) : null,
      home_team_logo_url: match.home_team_logo_url ? String(match.home_team_logo_url) : null,
      away_team_logo_url: match.away_team_logo_url ? String(match.away_team_logo_url) : null,
      home_score: Number.isInteger(Number(match.home_score)) ? Number(match.home_score) : null,
      away_score: Number.isInteger(Number(match.away_score)) ? Number(match.away_score) : null,
      home_penalty_score: Number.isInteger(Number(match.home_penalty_score)) ? Number(match.home_penalty_score) : null,
      away_penalty_score: Number.isInteger(Number(match.away_penalty_score)) ? Number(match.away_penalty_score) : null,
      status: String(match.status || 'pending'),
    }

    if (Object.prototype.hasOwnProperty.call(match, 'bracket_match_no')) {
      row.bracket_match_no = Number.isInteger(Number(match.bracket_match_no))
        ? Number(match.bracket_match_no)
        : null
    }

    if (Object.prototype.hasOwnProperty.call(match, 'home_seed_token')) {
      row.home_seed_token = match.home_seed_token ? String(match.home_seed_token) : null
    }

    if (Object.prototype.hasOwnProperty.call(match, 'away_seed_token')) {
      row.away_seed_token = match.away_seed_token ? String(match.away_seed_token) : null
    }

    return row
  })

  if (snapshotRows.length > 0) {
    const { error: snapshotError } = await supabase
      .from('simulation_match_snapshots')
      .upsert(snapshotRows, { onConflict: 'quiniela_id,match_id' })

    if (snapshotError?.code === '42703') {
      const legacyRows = snapshotRows.map((row: Record<string, unknown>) => {
        const {
          bracket_match_no: _ignoredMatchNo,
          home_seed_token: _ignoredHomeSeed,
          away_seed_token: _ignoredAwaySeed,
          ...legacy
        } = row

        return legacy
      })

      const { error: legacySnapshotError } = await supabase
        .from('simulation_match_snapshots')
        .upsert(legacyRows, { onConflict: 'quiniela_id,match_id' })

      if (legacySnapshotError) {
        throw createError({ statusCode: 500, statusMessage: legacySnapshotError.message })
      }
    } else if (snapshotError) {
      throw createError({ statusCode: 500, statusMessage: snapshotError.message })
    }
  }

  return {
    captured: true,
    matches: snapshotRows.length,
  }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user } = await requireGlobalAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')?.trim()

  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  const body = (await readBody(event).catch(() => ({}))) as SimulateBody
  const requestedSegment = String(body.segment || 'all').trim()

  if (!isSimulationSegment(requestedSegment)) {
    throw createError({ statusCode: 400, statusMessage: 'segment invalido' })
  }

  const segment: SimulationSegment = requestedSegment
  const simulateScores = body.simulate_scores !== false
  const simulatePopulation = body.simulate_population !== false
  const resetTestData = Boolean(body.reset_test_data)
  const usersCount = normalizeUsersCount(body.test_users_count)

  if (!simulateScores && !simulatePopulation) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona al menos una simulacion (scores o poblacion)' })
  }

  const { data: quiniela, error: quinielaError } = await supabase
    .from('quinielas')
    .select('id, name, has_test_data, admin_id')
    .eq('id', quinielaId)
    .maybeSingle()

  if (quinielaError) {
    throw createError({ statusCode: 500, statusMessage: quinielaError.message })
  }

  if (!quiniela) {
    throw createError({ statusCode: 404, statusMessage: 'Quiniela no encontrada' })
  }

  if (resetTestData) {
    await clearTestData(supabase, quinielaId)
  }

  const stages = getStagesBySegment(segment)
  let round32SlotsResolved = 0
  let round32SlotsUnresolved = 0
  let snapshotCaptured = false
  let snapshotMatches = 0
  let downstreamKnockoutReset = 0

  if (simulateScores) {
    await ensureNoActiveScoreSimulationFromAnotherQuiniela(supabase, quinielaId)
    const snapshotResult = await captureGlobalMatchesSnapshotIfMissing(supabase, quinielaId)
    snapshotCaptured = snapshotResult.captured
    snapshotMatches = snapshotResult.matches

    const resetResult = await resetDownstreamKnockoutSeeds(supabase, stages)
    downstreamKnockoutReset = resetResult.downstreamMatchesReset
  }

  if (simulateScores && stages.includes('round_32')) {
    const round32Resolution = await resolveRound32Participants(supabase, quinielaId)
    round32SlotsResolved = round32Resolution.resolvedSlots
    round32SlotsUnresolved = round32Resolution.unresolvedSlots
  }

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('*')
    .in('stage', stages)

  if (matchesError) {
    throw createError({ statusCode: 500, statusMessage: matchesError.message })
  }

  const selectedMatches = (matches || [])
    .map((item: any) => ({
      id: String(item.id),
      stage: String(item.stage),
      match_time: String(item.match_time || ''),
      api_fixture_id: Number(item.api_fixture_id || 0),
      bracket_match_no: Number(item.bracket_match_no || 0),
    }))
    .sort((a, b) => {
      const bracketDiff = a.bracket_match_no - b.bracket_match_no

      if (!Number.isNaN(bracketDiff) && bracketDiff !== 0) {
        return bracketDiff
      }

      const stagePriorityDiff =
        (STAGE_PRIORITY[a.stage] || 999) - (STAGE_PRIORITY[b.stage] || 999)

      if (stagePriorityDiff !== 0) {
        return stagePriorityDiff
      }

      const timeDiff =
        new Date(a.match_time).getTime() - new Date(b.match_time).getTime()

      if (!Number.isNaN(timeDiff) && timeDiff !== 0) {
        return timeDiff
      }

      const fixtureDiff = a.api_fixture_id - b.api_fixture_id

      if (fixtureDiff !== 0) {
        return fixtureDiff
      }

      return a.id.localeCompare(b.id)
    })

  if (selectedMatches.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No hay partidos para el segmento seleccionado' })
  }

  let updatedScores = 0
  let knockoutTiesResolved = 0

  if (simulateScores) {
    for (const match of selectedMatches) {
      let homeScore = randomInt(0, 4)
      let awayScore = randomInt(0, 4)

      if (KNOCKOUT_STAGES_NO_DRAW.has(match.stage) && homeScore === awayScore) {
        awayScore = (awayScore + 1) % 5
        knockoutTiesResolved += 1
      }

      const { error: scoreError } = await supabase
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          home_penalty_score: null,
          away_penalty_score: null,
          status: 'finished',
        })
        .eq('id', match.id)

      if (scoreError) {
        throw createError({ statusCode: 500, statusMessage: scoreError.message })
      }

      updatedScores += 1
    }
  }

  let createdUsers = 0
  let reusedUsers = 0
  let createdMembers = 0
  let upsertedPredictions = 0
  let adminPredictionsGenerated = 0

  if (simulatePopulation) {
    const adminId = String(quiniela.admin_id || '').trim()

    const nextTestUserIds: string[] = await loadReusableTestUserIds(
      supabase,
      quinielaId,
      usersCount,
    )

    reusedUsers = nextTestUserIds.length

    for (let i = nextTestUserIds.length; i < usersCount; i++) {
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`
      const email = `sim.${quinielaId.slice(0, 8)}.${seed}@example.local`
      const username = `${getTestUserPrefix(quinielaId)}${seed.slice(-6)}`
      const password = `Sim!${Math.random().toString(36).slice(-10)}A1`

      const { data: createdAuth, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
        },
      })

      if (createUserError || !createdAuth?.user?.id) {
        throw createError({
          statusCode: 500,
          statusMessage: createUserError?.message || 'No se pudo crear usuario de prueba',
        })
      }

      const testUserId = createdAuth.user.id
      nextTestUserIds.push(testUserId)
      createdUsers += 1

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: testUserId,
          username,
          is_test_user: true,
        }, { onConflict: 'id' })

      if (profileError) {
        throw createError({ statusCode: 500, statusMessage: profileError.message })
      }

      const { error: memberError } = await supabase
        .from('quiniela_members')
        .upsert({
          user_id: testUserId,
          quiniela_id: quinielaId,
          is_test_record: true,
        }, { onConflict: 'user_id,quiniela_id' })

      if (memberError) {
        throw createError({ statusCode: 500, statusMessage: memberError.message })
      }

      createdMembers += 1
    }

    if (nextTestUserIds.length > 0) {
      const recycledMembers = nextTestUserIds.map((userId) => ({
        user_id: userId,
        quiniela_id: quinielaId,
        is_test_record: true,
      }))

      const { error: recycledMembersError } = await supabase
        .from('quiniela_members')
        .upsert(recycledMembers, { onConflict: 'user_id,quiniela_id' })

      if (recycledMembersError) {
        throw createError({ statusCode: 500, statusMessage: recycledMembersError.message })
      }

      createdMembers += recycledMembers.length
    }

    if (nextTestUserIds.length > 0) {
      const predictionsBatch: Array<{
        user_id: string
        quiniela_id: string
        match_id: string
        home_score: number
        away_score: number
        is_test_record: boolean
      }> = []

      for (const userId of nextTestUserIds) {
        for (const match of selectedMatches) {
          predictionsBatch.push({
            user_id: userId,
            quiniela_id: quinielaId,
            match_id: match.id,
            home_score: randomInt(0, 4),
            away_score: randomInt(0, 4),
            is_test_record: true,
          })
        }
      }

      if (predictionsBatch.length > 0) {
        await upsertPredictionsInChunks(supabase, predictionsBatch)

        upsertedPredictions = predictionsBatch.length
      }
    }

    if (adminId) {
      const { error: adminMemberError } = await supabase
        .from('quiniela_members')
        .upsert({
          user_id: adminId,
          quiniela_id: quinielaId,
        }, { onConflict: 'user_id,quiniela_id' })

      if (adminMemberError) {
        throw createError({ statusCode: 500, statusMessage: adminMemberError.message })
      }

      const adminPredictions = selectedMatches.map((match) => ({
        user_id: adminId,
        quiniela_id: quinielaId,
        match_id: match.id,
        home_score: randomInt(0, 4),
        away_score: randomInt(0, 4),
        is_test_record: true,
      }))

      if (adminPredictions.length > 0) {
        const { data: adminPredictionsData, error: adminPredictionsError } = await supabase
          .from('predictions')
          .upsert(adminPredictions, {
            onConflict: 'user_id,quiniela_id,match_id',
            ignoreDuplicates: true,
          })
          .select('id')

        if (adminPredictionsError) {
          throw createError({ statusCode: 500, statusMessage: adminPredictionsError.message })
        }

        adminPredictionsGenerated = adminPredictionsData?.length ?? 0
      }
    }
  }

  const { error: recalcError } = await supabase.rpc('recalculate_quiniela_scoring', {
    p_quiniela_id: quinielaId,
  })

  if (recalcError) {
    throw createError({ statusCode: 500, statusMessage: recalcError.message })
  }

  const { data: refreshedQuiniela, error: refreshedQuinielaError } = await supabase
    .from('quinielas')
    .select('id, has_test_data')
    .eq('id', quinielaId)
    .maybeSingle()

  if (refreshedQuinielaError) {
    throw createError({ statusCode: 500, statusMessage: refreshedQuinielaError.message })
  }

  return {
    ok: true,
    quiniela: {
      id: quiniela.id,
      name: quiniela.name,
      has_test_data: Boolean(refreshedQuiniela?.has_test_data),
    },
    segment: {
      key: segment,
      label: getSimulationSegmentLabel(segment),
      stages,
    },
    summary: {
      simulate_scores: simulateScores,
      simulate_population: simulatePopulation,
      reset_test_data: resetTestData,
      matches_selected: selectedMatches.length,
      scores_updated: updatedScores,
      knockout_ties_resolved: knockoutTiesResolved,
      snapshot_captured: snapshotCaptured,
      snapshot_matches: snapshotMatches,
      knockout_downstream_reset: downstreamKnockoutReset,
      round32_slots_resolved: round32SlotsResolved,
      round32_slots_unresolved: round32SlotsUnresolved,
      users_created: createdUsers,
      users_reused: reusedUsers,
      members_created: createdMembers,
      predictions_upserted: upsertedPredictions,
      admin_predictions_generated: adminPredictionsGenerated,
      executed_by: user.id,
    },
  }
})
