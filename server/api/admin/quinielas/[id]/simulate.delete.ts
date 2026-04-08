import { createError, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../../../utils/adminAccess'
import { getStagesBySegment, isSimulationSegment, type SimulationSegment } from '../../../../utils/simulationSegments'

type SimulateDeleteBody = {
  segment?: string
  reset_scores?: boolean
}

type SnapshotRestoreResult = {
  restored: number
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
      home_score: Number.isInteger(Number(item.home_score)) ? Number(item.home_score) : null,
      away_score: Number.isInteger(Number(item.away_score)) ? Number(item.away_score) : null,
      home_penalty_score: Number.isInteger(Number(item.home_penalty_score)) ? Number(item.home_penalty_score) : null,
      away_penalty_score: Number.isInteger(Number(item.away_penalty_score)) ? Number(item.away_penalty_score) : null,
      status: String(item.status || 'pending'),
    }

    if (Object.prototype.hasOwnProperty.call(item, 'bracket_match_no')) {
      row.bracket_match_no = Number.isInteger(Number(item.bracket_match_no))
        ? Number(item.bracket_match_no)
        : null
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

  if (!isSimulationSegment(requestedSegment)) {
    throw createError({ statusCode: 400, statusMessage: 'segment invalido' })
  }

  const segment: SimulationSegment = requestedSegment
  const resetScores = body.reset_scores !== false

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

  if (resetScores) {
    const snapshotRestore = await restoreMatchesFromSnapshot(supabase, quinielaId)
    matchesRestoredFromSnapshot = snapshotRestore.restored

    if (matchesRestoredFromSnapshot === 0) {
      const resetStages = getStagesBySegment(segment)

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
    }
  }

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
      reset_scores: resetScores,
      matches_restored_from_snapshot: matchesRestoredFromSnapshot,
      matches_reset: matchesReset,
    },
  }
})
