import { createError, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../../../utils/adminAccess'
import { normalizeTeamKey, resolveTeamCode } from '../../../../../utils/teamMeta'
import {
  computeGroupRankings,
  isGenericSeedToken,
  isRound32SeedToken,
  resolveRound32SeedToken,
  KNOCKOUT_STAGE_FLOW,
  type GroupOverrideRow,
} from '../../../../utils/bracketEngine'
import { getStagesBySegment } from '../../../../utils/simulationSegments'

type BracketCommandBody = {
  command?: string
  payload?: any
}

type SetGroupOverridesPayload = {
  replace?: boolean
  items?: any[]
  groups?: Record<string, any>
}

type ClearGroupOverridesPayload = {
  groups?: string[]
}

const normalizeGroupCode = (value: unknown) => {
  const group = String(value || '').trim().toUpperCase()

  if (!/^[A-L]$/.test(group)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Grupo invalido: ${String(value || '').trim() || '(vacio)'}`,
    })
  }

  return group
}

const normalizePosition = (value: unknown) => {
  const position = Number(value)

  if (!Number.isInteger(position) || position < 1 || position > 4) {
    throw createError({
      statusCode: 400,
      statusMessage: `Posicion invalida: ${String(value || '').trim() || '(vacio)'}`,
    })
  }

  return position
}

const toOverrideEntry = (
  group: string,
  position: number,
  raw: unknown,
) => {
  if (typeof raw === 'string') {
    const teamName = raw.trim()

    if (!teamName) {
      throw createError({
        statusCode: 400,
        statusMessage: `team_name vacio para ${group}${position}`,
      })
    }

    return {
      group_code: group,
      position,
      team_name: teamName,
      team_code: resolveTeamCode(teamName),
      team_logo_url: null,
    }
  }

  if (!raw || typeof raw !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: `Entrada invalida para ${group}${position}`,
    })
  }

  const entry = raw as Record<string, unknown>
  const teamName = String(entry.team_name || entry.team || '').trim()

  if (!teamName) {
    throw createError({
      statusCode: 400,
      statusMessage: `team_name vacio para ${group}${position}`,
    })
  }

  return {
    group_code: group,
    position,
    team_name: teamName,
    team_code: entry.team_code ? String(entry.team_code).trim().toUpperCase() : resolveTeamCode(teamName),
    team_logo_url: entry.team_logo_url ? String(entry.team_logo_url).trim() : null,
  }
}

const buildOverridesFromPayload = (payload: SetGroupOverridesPayload) => {
  const next: Array<{
    group_code: string
    position: number
    team_name: string
    team_code: string | null
    team_logo_url: string | null
  }> = []

  for (const item of payload.items || []) {
    const group = normalizeGroupCode(item?.group_code ?? item?.group)
    const position = normalizePosition(item?.position)

    next.push(toOverrideEntry(group, position, item))
  }

  const groupsMap = payload.groups || {}

  for (const [rawGroup, rawValue] of Object.entries(groupsMap)) {
    const group = normalizeGroupCode(rawGroup)

    if (Array.isArray(rawValue)) {
      for (let index = 0; index < rawValue.length; index += 1) {
        const value = rawValue[index]
        const position = index + 1

        if (!value) {
          continue
        }

        next.push(toOverrideEntry(group, position, value))
      }

      continue
    }

    if (!rawValue || typeof rawValue !== 'object') {
      continue
    }

    const entry = rawValue as Record<string, unknown>

    for (const [rawPosition, value] of Object.entries(entry)) {
      if (!value) {
        continue
      }

      const position = normalizePosition(rawPosition)
      next.push(toOverrideEntry(group, position, value))
    }
  }

  if (next.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No se recibieron overrides para guardar',
    })
  }

  const uniqueKey = new Set<string>()

  for (const item of next) {
    const key = `${item.group_code}:${item.position}`

    if (uniqueKey.has(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Posicion duplicada en payload: ${item.group_code}${item.position}`,
      })
    }

    uniqueKey.add(key)
  }

  return next
}

const resolveMatchOutcome = (match: any) => {
  if (match?.status !== 'finished') {
    return null
  }

  const homeScore = Number(match?.home_score)
  const awayScore = Number(match?.away_score)

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    return null
  }

  if (homeScore > awayScore) {
    return {
      winner: String(match.home_team || ''),
      loser: String(match.away_team || ''),
    }
  }

  if (awayScore > homeScore) {
    return {
      winner: String(match.away_team || ''),
      loser: String(match.home_team || ''),
    }
  }

  const homePenalty = Number(match?.home_penalty_score)
  const awayPenalty = Number(match?.away_penalty_score)

  if (!Number.isInteger(homePenalty) || !Number.isInteger(awayPenalty) || homePenalty === awayPenalty) {
    return null
  }

  if (homePenalty > awayPenalty) {
    return {
      winner: String(match.home_team || ''),
      loser: String(match.away_team || ''),
    }
  }

  return {
    winner: String(match.away_team || ''),
    loser: String(match.home_team || ''),
  }
}

const loadGroupOverrides = async (supabase: any, quinielaId: string): Promise<GroupOverrideRow[]> => {
  const { data, error } = await supabase
    .from('quiniela_group_overrides')
    .select('group_code, position, team_name, team_code, team_logo_url')
    .eq('quiniela_id', quinielaId)

  if (error?.code === '42P01') {
    throw createError({
      statusCode: 400,
      statusMessage: 'La base no tiene soporte para overrides. Aplica la migracion 0029_bracket_engine_tokens_and_group_overrides.sql',
    })
  }

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data || []) as GroupOverrideRow[]
}

const resolveRound32FromCurrentState = async (supabase: any, quinielaId: string) => {
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

  const candidateTeamKeys = new Set<string>()

  for (const rows of rankedByGroup.values()) {
    for (const row of rows) {
      const key = normalizeTeamKey(row.team)

      if (key) {
        candidateTeamKeys.add(key)
      }
    }
  }

  const profileByTeamKey = new Map<string, { code: string | null; logo_url: string | null }>()

  if (candidateTeamKeys.size > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('team_profiles')
      .select('team_key, code, logo_url')
      .in('team_key', [...candidateTeamKeys])

    if (profilesError && profilesError.code !== '42P01') {
      throw createError({ statusCode: 500, statusMessage: profilesError.message })
    }

    for (const profile of profiles || []) {
      const key = String(profile.team_key || '')

      if (!key) {
        continue
      }

      profileByTeamKey.set(key, {
        code: profile.code ? String(profile.code) : null,
        logo_url: profile.logo_url ? String(profile.logo_url) : null,
      })
    }
  }

  const sortedRound32 = [...(round32Matches || [])].sort((a: any, b: any) => {
    const byBracketNo = Number(a.bracket_match_no || 0) - Number(b.bracket_match_no || 0)

    if (!Number.isNaN(byBracketNo) && byBracketNo !== 0) {
      return byBracketNo
    }

    const byTime =
      new Date(String(a.match_time || '')).getTime()
      - new Date(String(b.match_time || '')).getTime()

    if (!Number.isNaN(byTime) && byTime !== 0) {
      return byTime
    }

    return String(a.id || '').localeCompare(String(b.id || ''))
  })

  let resolvedSlots = 0
  let unresolvedSlots = 0
  const thirdPlaceUsed = new Set<string>()

  for (const match of sortedRound32) {
    const supportsSeedColumns =
      Object.prototype.hasOwnProperty.call(match, 'home_seed_token')
      && Object.prototype.hasOwnProperty.call(match, 'away_seed_token')

    const patch: Record<string, unknown> = {}

    const resolveSide = (side: 'home' | 'away') => {
      const seedToken = String(
        side === 'home'
          ? (match.home_seed_token || match.home_team || '')
          : (match.away_seed_token || match.away_team || ''),
      ).trim()

      if (!isRound32SeedToken(seedToken)) {
        return
      }

      const resolvedTeam = resolveRound32SeedToken(
        seedToken,
        rankedByGroup,
        thirdPlaceRows,
        thirdPlaceUsed,
      )

      if (!resolvedTeam) {
        unresolvedSlots += 1
        return
      }

      const key = normalizeTeamKey(resolvedTeam)
      const profile = profileByTeamKey.get(key)
      const code = profile?.code || resolveTeamCode(resolvedTeam)
      const logo = profile?.logo_url || null

      if (side === 'home') {
        patch.home_team = resolvedTeam
        patch.home_team_code = code
        patch.home_team_logo_url = logo

        if (supportsSeedColumns) {
          patch.home_seed_token = seedToken
        }
      } else {
        patch.away_team = resolvedTeam
        patch.away_team_code = code
        patch.away_team_logo_url = logo

        if (supportsSeedColumns) {
          patch.away_seed_token = seedToken
        }
      }

      resolvedSlots += 1
    }

    resolveSide('home')
    resolveSide('away')

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

  const { data: refreshedRound32, error: refreshedRound32Error } = await supabase
    .from('matches')
    .select('*')
    .eq('stage', 'round_32')
    .order('bracket_match_no', { ascending: true })

  if (refreshedRound32Error) {
    throw createError({ statusCode: 500, statusMessage: refreshedRound32Error.message })
  }

  return {
    resolvedSlots,
    unresolvedSlots,
    round32: refreshedRound32 || [],
  }
}

const projectBracket = async (supabase: any) => {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .in('stage', KNOCKOUT_STAGE_FLOW)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const byNumber = new Map<number, any>()

  for (const match of matches || []) {
    const matchNo = Number(match.bracket_match_no || 0)

    if (Number.isInteger(matchNo) && matchNo > 0) {
      byNumber.set(matchNo, match)
    }
  }

  const resolveTokenToTeam = (token: string): string | null => {
    const trimmed = String(token || '').trim()

    const winnerMatch = trimmed.match(/^W(\d{2,3})$/i)

    if (winnerMatch?.[1]) {
      const refNo = Number(winnerMatch[1])
      const refMatch = byNumber.get(refNo)

      if (!refMatch) {
        return null
      }

      const outcome = resolveMatchOutcome(refMatch)

      return outcome?.winner || null
    }

    const loserMatch = trimmed.match(/^L(\d{2,3})$/i)

    if (loserMatch?.[1]) {
      const refNo = Number(loserMatch[1])
      const refMatch = byNumber.get(refNo)

      if (!refMatch) {
        return null
      }

      const outcome = resolveMatchOutcome(refMatch)

      return outcome?.loser || null
    }

    return null
  }

  const projected = [...byNumber.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([matchNo, match]) => {
      const homeSeed = String(match.home_seed_token || match.home_team || '').trim()
      const awaySeed = String(match.away_seed_token || match.away_team || '').trim()

      const projectedHomeByToken = isGenericSeedToken(homeSeed)
        ? resolveTokenToTeam(homeSeed)
        : String(match.home_team || '')
      const projectedAwayByToken = isGenericSeedToken(awaySeed)
        ? resolveTokenToTeam(awaySeed)
        : String(match.away_team || '')

      const projectedHome = projectedHomeByToken || (match.home_team ? String(match.home_team) : null)
      const projectedAway = projectedAwayByToken || (match.away_team ? String(match.away_team) : null)

      return {
        match_no: matchNo,
        stage: String(match.stage || ''),
        status: String(match.status || 'pending'),
        home_seed_token: homeSeed || null,
        away_seed_token: awaySeed || null,
        home_team: match.home_team ? String(match.home_team) : null,
        away_team: match.away_team ? String(match.away_team) : null,
        projected_home_team: projectedHome,
        projected_away_team: projectedAway,
        home_score: Number.isInteger(Number(match.home_score)) ? Number(match.home_score) : null,
        away_score: Number.isInteger(Number(match.away_score)) ? Number(match.away_score) : null,
        home_penalty_score: Number.isInteger(Number(match.home_penalty_score)) ? Number(match.home_penalty_score) : null,
        away_penalty_score: Number.isInteger(Number(match.away_penalty_score)) ? Number(match.away_penalty_score) : null,
      }
    })

  return projected
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user } = await requireGlobalAdminAccess(event, supabase)

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

  if (!quiniela?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Quiniela no encontrada' })
  }

  const body = (await readBody(event).catch(() => ({}))) as BracketCommandBody
  const command = String(body.command || '').trim()
  const payload = body.payload || {}

  if (!command) {
    throw createError({ statusCode: 400, statusMessage: 'command requerido' })
  }

  if (command === 'set_group_overrides') {
    const parsedPayload = payload as SetGroupOverridesPayload
    const replace = parsedPayload.replace !== false
    const entries = buildOverridesFromPayload(parsedPayload)

    if (replace) {
      const groups = [...new Set(entries.map((entry) => entry.group_code))]

      const { error: deleteError } = await supabase
        .from('quiniela_group_overrides')
        .delete()
        .eq('quiniela_id', quinielaId)
        .in('group_code', groups)

      if (deleteError?.code === '42P01') {
        throw createError({
          statusCode: 400,
          statusMessage: 'La base no tiene soporte para overrides. Aplica la migracion 0029_bracket_engine_tokens_and_group_overrides.sql',
        })
      }

      if (deleteError) {
        throw createError({ statusCode: 500, statusMessage: deleteError.message })
      }
    }

    const upsertRows = entries.map((entry) => ({
      quiniela_id: quinielaId,
      group_code: entry.group_code,
      position: entry.position,
      team_name: entry.team_name,
      team_code: entry.team_code,
      team_logo_url: entry.team_logo_url,
      updated_by: user.id,
    }))

    const { error: upsertError } = await supabase
      .from('quiniela_group_overrides')
      .upsert(upsertRows, { onConflict: 'quiniela_id,group_code,position' })

    if (upsertError?.code === '42P01') {
      throw createError({
        statusCode: 400,
        statusMessage: 'La base no tiene soporte para overrides. Aplica la migracion 0029_bracket_engine_tokens_and_group_overrides.sql',
      })
    }

    if (upsertError) {
      throw createError({ statusCode: 500, statusMessage: upsertError.message })
    }

    const latest = await loadGroupOverrides(supabase, quinielaId)

    return {
      ok: true,
      command,
      quiniela: {
        id: quiniela.id,
        name: quiniela.name,
      },
      summary: {
        replace,
        entries_saved: entries.length,
        groups_affected: [...new Set(entries.map((entry) => entry.group_code))],
      },
      overrides: latest,
    }
  }

  if (command === 'clear_group_overrides') {
    const parsedPayload = payload as ClearGroupOverridesPayload
    const groups = (parsedPayload.groups || []).map((value) => normalizeGroupCode(value))

    let query = supabase
      .from('quiniela_group_overrides')
      .delete()
      .eq('quiniela_id', quinielaId)

    if (groups.length > 0) {
      query = query.in('group_code', groups)
    }

    const { data: removed, error: removeError } = await query.select('group_code, position')

    if (removeError?.code === '42P01') {
      throw createError({
        statusCode: 400,
        statusMessage: 'La base no tiene soporte para overrides. Aplica la migracion 0029_bracket_engine_tokens_and_group_overrides.sql',
      })
    }

    if (removeError) {
      throw createError({ statusCode: 500, statusMessage: removeError.message })
    }

    return {
      ok: true,
      command,
      quiniela: {
        id: quiniela.id,
        name: quiniela.name,
      },
      summary: {
        groups_cleared: groups,
        rows_removed: (removed || []).length,
      },
    }
  }

  if (command === 'resolve_round32') {
    const result = await resolveRound32FromCurrentState(supabase, quinielaId)

    return {
      ok: true,
      command,
      quiniela: {
        id: quiniela.id,
        name: quiniela.name,
      },
      summary: {
        resolved_slots: result.resolvedSlots,
        unresolved_slots: result.unresolvedSlots,
      },
      round32: result.round32,
    }
  }

  if (command === 'project_bracket') {
    const projection = await projectBracket(supabase)

    return {
      ok: true,
      command,
      quiniela: {
        id: quiniela.id,
        name: quiniela.name,
      },
      projection,
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: `Comando no soportado: ${command}`,
  })
})
