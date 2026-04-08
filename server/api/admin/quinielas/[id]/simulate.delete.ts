import { createError, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../../../utils/adminAccess'
import {
  BRACKET_MATCH_NUMBERS_BY_STAGE,
  getDefaultSeedPairByMatchNumber,
  KNOCKOUT_STAGE_FLOW,
  type KnockoutStage,
} from '../../../../utils/bracketEngine'
import { getStagesBySegment, isSimulationSegment, type SimulationSegment } from '../../../../utils/simulationSegments'

type ResetScope = 'all' | 'segment'

type SimulateDeleteBody = {
  segment?: string
  reset_scores?: boolean
  reset_scope?: string
  clear_all_predictions?: boolean
  clear_all_members?: boolean
  clear_manual_points?: boolean
}

type SnapshotRestoreResult = {
  restored: number
}

const toNullableInteger = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null
  }

  return parsed
}

const toNullableBracketMatchNo = (value: unknown): number | null => {
  const parsed = toNullableInteger(value)

  if (parsed === null) {
    return null
  }

  return parsed >= 73 && parsed <= 104 ? parsed : null
}

const isResetScope = (value: string): value is ResetScope => {
  return value === 'all' || value === 'segment'
}

const isKnockoutStage = (value: string): value is KnockoutStage => {
  return KNOCKOUT_STAGE_FLOW.includes(value as KnockoutStage)
}

const getExpectedBracketMatchNo = (stage: KnockoutStage, index: number): number | null => {
  const numbers = BRACKET_MATCH_NUMBERS_BY_STAGE[stage]
  const expected = numbers?.[index]

  return Number.isInteger(expected) ? Number(expected) : null
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

const resetKnockoutStagesToSeedState = async (
  supabase: any,
  stages: KnockoutStage[],
) => {
  let resetRows = 0

  for (const stage of stages) {
    const { data: rows, error: rowsError } = await supabase
      .from('matches')
      .select('*')
      .eq('stage', stage)

    if (rowsError) {
      throw createError({ statusCode: 500, statusMessage: rowsError.message })
    }

    const sortedRows = sortMatchesByStageTime(rows || [])

    for (let index = 0; index < sortedRows.length; index += 1) {
      const row = sortedRows[index]
      const expectedMatchNo = getExpectedBracketMatchNo(stage, index)
      const expectedSeeds = expectedMatchNo
        ? getDefaultSeedPairByMatchNumber(expectedMatchNo)
        : null

      if (!expectedMatchNo || !expectedSeeds) {
        continue
      }

      const patch: Record<string, unknown> = {
        home_team: expectedSeeds.home,
        away_team: expectedSeeds.away,
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

      if (Object.prototype.hasOwnProperty.call(row, 'bracket_match_no')) {
        patch.bracket_match_no = expectedMatchNo
      }

      if (
        Object.prototype.hasOwnProperty.call(row, 'home_seed_token')
        && Object.prototype.hasOwnProperty.call(row, 'away_seed_token')
      ) {
        patch.home_seed_token = expectedSeeds.home
        patch.away_seed_token = expectedSeeds.away
      }

      const { error: patchError } = await supabase
        .from('matches')
        .update(patch)
        .eq('id', row.id)

      if (patchError) {
        throw createError({ statusCode: 500, statusMessage: patchError.message })
      }

      resetRows += 1
    }
  }

  return {
    resetRows,
  }
}

const sanitizeInvalidBracketMatchNumbers = async (supabase: any) => {
  const { data: invalidRows, error: invalidRowsError } = await supabase
    .from('matches')
    .select('id')
    .not('bracket_match_no', 'is', null)
    .or('bracket_match_no.lt.73,bracket_match_no.gt.104')

  if (invalidRowsError?.code === '42703') {
    return 0
  }

  if (invalidRowsError) {
    throw createError({ statusCode: 500, statusMessage: invalidRowsError.message })
  }

  const invalidIds = (invalidRows || []).map((row: any) => String(row.id)).filter(Boolean)

  if (invalidIds.length === 0) {
    return 0
  }

  const { error: sanitizeError } = await supabase
    .from('matches')
    .update({ bracket_match_no: null })
    .in('id', invalidIds)

  if (sanitizeError?.code === '42703') {
    return 0
  }

  if (sanitizeError) {
    throw createError({ statusCode: 500, statusMessage: sanitizeError.message })
  }

  return invalidIds.length
}

const restoreMatchesFromSnapshot = async (
  supabase: any,
  quinielaId: string,
): Promise<SnapshotRestoreResult> => {
  const { data: snapshotRows, error: snapshotRowsError } = await supabase
    .from('simulation_match_snapshots')
    .select('*')
    .eq('quiniela_id', quinielaId)

  if (snapshotRowsError?.code === '42P01') {
    return {
      restored: 0,
    }
  }

  if (snapshotRowsError) {
    throw createError({ statusCode: 500, statusMessage: snapshotRowsError.message })
  }

  const rows = (snapshotRows || []).map((item: any) => {
    const row: Record<string, unknown> = {
      id: String(item.match_id),
      home_team: String(item.home_team || ''),
      away_team: String(item.away_team || ''),
      home_team_code: item.home_team_code ? String(item.home_team_code) : null,
      away_team_code: item.away_team_code ? String(item.away_team_code) : null,
      home_team_logo_url: item.home_team_logo_url ? String(item.home_team_logo_url) : null,
      away_team_logo_url: item.away_team_logo_url ? String(item.away_team_logo_url) : null,
      home_score: toNullableInteger(item.home_score),
      away_score: toNullableInteger(item.away_score),
      home_penalty_score: toNullableInteger(item.home_penalty_score),
      away_penalty_score: toNullableInteger(item.away_penalty_score),
      status: String(item.status || 'pending'),
    }

    if (Object.prototype.hasOwnProperty.call(item, 'bracket_match_no')) {
      row.bracket_match_no = toNullableBracketMatchNo(item.bracket_match_no)
    }

    if (Object.prototype.hasOwnProperty.call(item, 'home_seed_token')) {
      row.home_seed_token = item.home_seed_token ? String(item.home_seed_token) : null
    }

    if (Object.prototype.hasOwnProperty.call(item, 'away_seed_token')) {
      row.away_seed_token = item.away_seed_token ? String(item.away_seed_token) : null
    }

    return row
  })

  if (rows.length > 0) {
    for (const row of rows) {
      const matchId = String(row.id || '')

      if (!matchId) {
        continue
      }

      const {
        id: _ignored,
        ...patch
      } = row

      const { error: restoreError } = await supabase
        .from('matches')
        .update(patch)
        .eq('id', matchId)

      if (restoreError?.code === '42703') {
        const {
          bracket_match_no: _ignoredMatchNo,
          home_seed_token: _ignoredHomeSeed,
          away_seed_token: _ignoredAwaySeed,
          ...legacyPatch
        } = patch

        const { error: legacyRestoreError } = await supabase
          .from('matches')
          .update(legacyPatch)
          .eq('id', matchId)

        if (legacyRestoreError) {
          throw createError({ statusCode: 500, statusMessage: legacyRestoreError.message })
        }
      } else if (restoreError) {
        throw createError({ statusCode: 500, statusMessage: restoreError.message })
      }
    }
  }

  const { error: deleteSnapshotError } = await supabase
    .from('simulation_match_snapshots')
    .delete()
    .eq('quiniela_id', quinielaId)

  if (deleteSnapshotError) {
    throw createError({ statusCode: 500, statusMessage: deleteSnapshotError.message })
  }

  return {
    restored: rows.length,
  }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireGlobalAdminAccess(event, supabase)

  const body = (await readBody(event).catch(() => ({}))) as SimulateDeleteBody
  const requestedSegment = String(body.segment || 'all').trim()
  const requestedScope = String(body.reset_scope || '').trim().toLowerCase()

  if (!isSimulationSegment(requestedSegment)) {
    throw createError({ statusCode: 400, statusMessage: 'segment invalido' })
  }

  const segment: SimulationSegment = requestedSegment
  const resetScores = body.reset_scores !== false
  const resetScope: ResetScope = isResetScope(requestedScope) ? requestedScope : 'all'
  const clearAllPredictions = Boolean(body.clear_all_predictions)
  const clearAllMembers = Boolean(body.clear_all_members)
  const clearManualPoints = Boolean(body.clear_manual_points)
  const forceHardReset = resetScope === 'all' && clearAllPredictions

  const quinielaId = getRouterParam(event, 'id')?.trim()

  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  const { data: quiniela, error: quinielaError } = await supabase
    .from('quinielas')
    .select('id, name')
    .eq('id', quinielaId)
    .maybeSingle()

  if (quinielaError) {
    throw createError({ statusCode: 500, statusMessage: quinielaError.message })
  }

  if (!quiniela) {
    throw createError({ statusCode: 404, statusMessage: 'Quiniela no encontrada' })
  }

  let matchesReset = 0
  let matchesRestoredFromSnapshot = 0
  let knockoutSeedsReset = 0
  const invalidBracketMatchNumbersFixed = await sanitizeInvalidBracketMatchNumbers(supabase)

  if (resetScores) {
    const snapshotRestore = await restoreMatchesFromSnapshot(supabase, quinielaId)
    matchesRestoredFromSnapshot = snapshotRestore.restored

    if (matchesRestoredFromSnapshot === 0 || forceHardReset) {
      const effectiveSegment: SimulationSegment = resetScope === 'all' || forceHardReset ? 'all' : segment
      const resetStages = getStagesBySegment(effectiveSegment)

      const { data: toReset, error: toResetError } = await supabase
        .from('matches')
        .select('id')
        .in('stage', resetStages)

      if (toResetError) {
        throw createError({ statusCode: 500, statusMessage: toResetError.message })
      }

      const resetIds = (toReset || []).map((item: any) => String(item.id)).filter(Boolean)

      if (resetIds.length > 0) {
        const { error: resetMatchesError } = await supabase
          .from('matches')
          .update({
            home_score: null,
            away_score: null,
            home_penalty_score: null,
            away_penalty_score: null,
            status: 'pending',
          })
          .in('id', resetIds)

        if (resetMatchesError) {
          throw createError({ statusCode: 500, statusMessage: resetMatchesError.message })
        }

        matchesReset = resetIds.length
      }

      const knockoutStagesToReset: KnockoutStage[] = []

      if (resetScope === 'all') {
        knockoutStagesToReset.push(...KNOCKOUT_STAGE_FLOW)
      } else if (isKnockoutStage(segment)) {
        const startIndex = KNOCKOUT_STAGE_FLOW.indexOf(segment)

        if (startIndex >= 0) {
          knockoutStagesToReset.push(...KNOCKOUT_STAGE_FLOW.slice(startIndex))
        }
      }

      if (knockoutStagesToReset.length > 0) {
        const knockoutReset = await resetKnockoutStagesToSeedState(
          supabase,
          knockoutStagesToReset,
        )
        knockoutSeedsReset = knockoutReset.resetRows
      }
    }
  }

  let predictionsDeleted = 0
  const predictionsDeleteQuery = supabase
    .from('predictions')
    .delete()
    .eq('quiniela_id', quinielaId)

  const { data: deletedPredictions, error: predictionsDeleteError } = clearAllPredictions
    ? await predictionsDeleteQuery.select('id')
    : await predictionsDeleteQuery.eq('is_test_record', true).select('id')

  if (predictionsDeleteError) {
    throw createError({ statusCode: 500, statusMessage: predictionsDeleteError.message })
  }

  predictionsDeleted = (deletedPredictions || []).length

  let membersDeleted = 0
  const membersDeleteQuery = supabase
    .from('quiniela_members')
    .delete()
    .eq('quiniela_id', quinielaId)

  const { data: deletedMembers, error: membersDeleteError } = clearAllMembers
    ? await membersDeleteQuery.select('user_id')
    : await membersDeleteQuery.eq('is_test_record', true).select('user_id')

  if (membersDeleteError) {
    throw createError({ statusCode: 500, statusMessage: membersDeleteError.message })
  }

  membersDeleted = (deletedMembers || []).length

  let manualPointsDeleted = 0

  if (clearManualPoints) {
    const { data: deletedManualPoints, error: manualPointsDeleteError } = await supabase
      .from('quiniela_member_manual_points')
      .delete()
      .eq('quiniela_id', quinielaId)
      .select('id')

    if (manualPointsDeleteError && manualPointsDeleteError.code !== '42P01') {
      throw createError({ statusCode: 500, statusMessage: manualPointsDeleteError.message })
    }

    manualPointsDeleted = (deletedManualPoints || []).length
  }

  const { error: recalcError } = await supabase.rpc('recalculate_quiniela_scoring', {
    p_quiniela_id: quinielaId,
  })

  if (recalcError) {
    throw createError({ statusCode: 500, statusMessage: recalcError.message })
  }

  const { data: refreshed, error: refreshedError } = await supabase
    .from('quinielas')
    .select('id, has_test_data')
    .eq('id', quinielaId)
    .maybeSingle()

  if (refreshedError) {
    throw createError({ statusCode: 500, statusMessage: refreshedError.message })
  }

  return {
    ok: true,
    quiniela: {
      id: quiniela.id,
      name: quiniela.name,
      has_test_data: Boolean(refreshed?.has_test_data),
    },
    summary: {
      segment,
      reset_scope: resetScope,
      hard_reset_applied: forceHardReset,
      reset_scores: resetScores,
      matches_restored_from_snapshot: matchesRestoredFromSnapshot,
      matches_reset: matchesReset,
      knockout_seeds_reset: knockoutSeedsReset,
      invalid_bracket_match_no_fixed: invalidBracketMatchNumbersFixed,
      clear_all_predictions: clearAllPredictions,
      clear_all_members: clearAllMembers,
      clear_manual_points: clearManualPoints,
      predictions_deleted: predictionsDeleted,
      members_deleted: membersDeleted,
      manual_points_deleted: manualPointsDeleted,
    },
  }
})
