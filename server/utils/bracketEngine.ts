import type { MatchStage } from './apiFootball'

export type KnockoutStage =
  | 'round_32'
  | 'round_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final'

export type GroupStandingRow = {
  group: string
  team: string
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
}

export type GroupOverrideRow = {
  group_code: string
  position: number
  team_name: string
  team_code?: string | null
  team_logo_url?: string | null
}

export const KNOCKOUT_STAGE_FLOW: KnockoutStage[] = [
  'round_32',
  'round_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
]

export const BRACKET_DEFINITION: Record<number, {
  stage: KnockoutStage
  homeSeedToken: string
  awaySeedToken: string
}> = {
  73: { stage: 'round_32', homeSeedToken: '2A', awaySeedToken: '2B' },
  74: { stage: 'round_32', homeSeedToken: '1E', awaySeedToken: '3rd(A/B/C/D/F)' },
  75: { stage: 'round_32', homeSeedToken: '1F', awaySeedToken: '2C' },
  76: { stage: 'round_32', homeSeedToken: '1C', awaySeedToken: '2F' },
  77: { stage: 'round_32', homeSeedToken: '1I', awaySeedToken: '3rd(C/D/F/G/H)' },
  78: { stage: 'round_32', homeSeedToken: '2E', awaySeedToken: '2I' },
  79: { stage: 'round_32', homeSeedToken: '1A', awaySeedToken: '3rd(C/E/F/H/I)' },
  80: { stage: 'round_32', homeSeedToken: '1L', awaySeedToken: '3rd(E/H/I/J/K)' },
  81: { stage: 'round_32', homeSeedToken: '1D', awaySeedToken: '3rd(B/E/F/I/J)' },
  82: { stage: 'round_32', homeSeedToken: '1G', awaySeedToken: '3rd(A/E/H/I/J)' },
  83: { stage: 'round_32', homeSeedToken: '2K', awaySeedToken: '2L' },
  84: { stage: 'round_32', homeSeedToken: '1H', awaySeedToken: '2J' },
  85: { stage: 'round_32', homeSeedToken: '1B', awaySeedToken: '3rd(E/F/G/I/J)' },
  86: { stage: 'round_32', homeSeedToken: '1J', awaySeedToken: '2H' },
  87: { stage: 'round_32', homeSeedToken: '1K', awaySeedToken: '3rd(D/E/I/J/L)' },
  88: { stage: 'round_32', homeSeedToken: '2D', awaySeedToken: '2G' },
  89: { stage: 'round_16', homeSeedToken: 'W74', awaySeedToken: 'W77' },
  90: { stage: 'round_16', homeSeedToken: 'W73', awaySeedToken: 'W75' },
  91: { stage: 'round_16', homeSeedToken: 'W76', awaySeedToken: 'W78' },
  92: { stage: 'round_16', homeSeedToken: 'W79', awaySeedToken: 'W80' },
  93: { stage: 'round_16', homeSeedToken: 'W83', awaySeedToken: 'W84' },
  94: { stage: 'round_16', homeSeedToken: 'W81', awaySeedToken: 'W82' },
  95: { stage: 'round_16', homeSeedToken: 'W86', awaySeedToken: 'W88' },
  96: { stage: 'round_16', homeSeedToken: 'W85', awaySeedToken: 'W87' },
  97: { stage: 'quarter_final', homeSeedToken: 'W89', awaySeedToken: 'W90' },
  98: { stage: 'quarter_final', homeSeedToken: 'W93', awaySeedToken: 'W94' },
  99: { stage: 'quarter_final', homeSeedToken: 'W91', awaySeedToken: 'W92' },
  100: { stage: 'quarter_final', homeSeedToken: 'W95', awaySeedToken: 'W96' },
  101: { stage: 'semi_final', homeSeedToken: 'W97', awaySeedToken: 'W98' },
  102: { stage: 'semi_final', homeSeedToken: 'W99', awaySeedToken: 'W100' },
  103: { stage: 'third_place', homeSeedToken: 'L101', awaySeedToken: 'L102' },
  104: { stage: 'final', homeSeedToken: 'W101', awaySeedToken: 'W102' },
}

export const BRACKET_MATCH_NUMBERS_BY_STAGE: Record<KnockoutStage, number[]> = {
  round_32: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
  round_16: [89, 90, 91, 92, 93, 94, 95, 96],
  quarter_final: [97, 98, 99, 100],
  semi_final: [101, 102],
  third_place: [103],
  final: [104],
}

export const DIRECT_SEED_TOKEN_RE = /^([1-4])([A-L])$/i
export const BEST_THIRD_TOKEN_RE = /^(?:mejor\s*3ro|3rd)\s*\(?\s*([A-L](?:\s*\/\s*[A-L])*)\s*\)?$/i
export const WINNER_TOKEN_RE = /^W\s*(\d{2,3})$/i
export const LOSER_TOKEN_RE = /^L\s*(\d{2,3})$/i

const extractBestThirdGroups = (value: string): string[] | null => {
  const match = String(value || '').trim().match(BEST_THIRD_TOKEN_RE)

  if (!match?.[1]) {
    return null
  }

  const groups = match[1]
    .split('/')
    .map((part) => part.trim().toUpperCase())
    .filter((group) => /^[A-L]$/.test(group))

  if (groups.length === 0) {
    return null
  }

  return [...new Set(groups)]
}

export const normalizeBestThirdToken = (value: string): string | null => {
  const groups = extractBestThirdGroups(value)

  if (!groups) {
    return null
  }

  return `3rd(${groups.join('/')})`
}

export const normalizeDirectSeedToken = (value: string): string | null => {
  const match = String(value || '').trim().match(DIRECT_SEED_TOKEN_RE)

  if (!match?.[1] || !match[2]) {
    return null
  }

  return `${match[1]}${match[2].toUpperCase()}`
}

export const canonicalizeSeedToken = (value: string): string => {
  const direct = normalizeDirectSeedToken(value)

  if (direct) {
    return direct
  }

  const bestThird = normalizeBestThirdToken(value)

  if (bestThird) {
    return bestThird
  }

  const winner = String(value || '').trim().match(WINNER_TOKEN_RE)

  if (winner?.[1]) {
    return `W${Number(winner[1])}`
  }

  const loser = String(value || '').trim().match(LOSER_TOKEN_RE)

  if (loser?.[1]) {
    return `L${Number(loser[1])}`
  }

  return String(value || '').trim()
}

export const isRound32SeedToken = (value: string) => {
  const direct = normalizeDirectSeedToken(value)
  if (direct) {
    return /^([12][A-L])$/.test(direct)
  }

  return normalizeBestThirdToken(value) !== null
}

export const isGenericSeedToken = (value: string) => {
  const token = canonicalizeSeedToken(value)

  return Boolean(
    normalizeDirectSeedToken(token)
    || normalizeBestThirdToken(token)
    || token.match(WINNER_TOKEN_RE)
    || token.match(LOSER_TOKEN_RE),
  )
}

export const compareStandings = (a: GroupStandingRow, b: GroupStandingRow) => {
  return (
    b.points - a.points
    || b.goalDiff - a.goalDiff
    || b.goalsFor - a.goalsFor
    || a.team.localeCompare(b.team, 'es', { sensitivity: 'base' })
  )
}

const applyGroupOverrides = (
  rankedByGroup: Map<string, GroupStandingRow[]>,
  overrides: GroupOverrideRow[],
) => {
  const overridesByGroup = new Map<string, GroupOverrideRow[]>()

  for (const row of overrides) {
    const group = String(row.group_code || '').trim().toUpperCase()

    if (!/^[A-L]$/.test(group)) {
      continue
    }

    const position = Number(row.position)

    if (!Number.isInteger(position) || position < 1 || position > 4) {
      continue
    }

    if (!overridesByGroup.has(group)) {
      overridesByGroup.set(group, [])
    }

    overridesByGroup.get(group)?.push({
      ...row,
      group_code: group,
      position,
      team_name: String(row.team_name || '').trim(),
    })
  }

  for (const [group, rows] of overridesByGroup.entries()) {
    const validRows = rows
      .filter((item) => item.team_name)
      .sort((a, b) => a.position - b.position)

    if (validRows.length === 0) {
      continue
    }

    const current = rankedByGroup.get(group) || []
    const currentByTeam = new Map(current.map((item) => [item.team, item]))
    const manualByPosition = new Map<number, GroupStandingRow>()
    const usedTeams = new Set<string>()

    for (const item of validRows) {
      const base = currentByTeam.get(item.team_name)

      manualByPosition.set(item.position, {
        group,
        team: item.team_name,
        points: base?.points ?? 0,
        goalsFor: base?.goalsFor ?? 0,
        goalsAgainst: base?.goalsAgainst ?? 0,
        goalDiff: base?.goalDiff ?? 0,
      })

      usedTeams.add(item.team_name)
    }

    const nextRows: GroupStandingRow[] = []

    for (let index = 1; index <= 4; index += 1) {
      const manual = manualByPosition.get(index)

      if (manual) {
        nextRows.push(manual)
        continue
      }

      const fallback = current.find((row) => !usedTeams.has(row.team))

      if (!fallback) {
        continue
      }

      usedTeams.add(fallback.team)
      nextRows.push(fallback)
    }

    rankedByGroup.set(group, nextRows)
  }
}

export const computeGroupRankings = (
  groupMatches: any[],
  overrides: GroupOverrideRow[] = [],
) => {
  const groups = new Map<string, Map<string, Omit<GroupStandingRow, 'goalDiff'>>>()

  const ensureRow = (group: string, teamName: string) => {
    let table = groups.get(group)

    if (!table) {
      table = new Map()
      groups.set(group, table)
    }

    const key = (teamName || '').trim()

    if (!key) {
      return null
    }

    if (!table.has(key)) {
      table.set(key, {
        group,
        team: key,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      })
    }

    return table.get(key) || null
  }

  for (const match of groupMatches) {
    const stage = String(match.stage || '')

    if (!stage.startsWith('group_')) {
      continue
    }

    const group = stage.replace('group_', '').toUpperCase()
    const home = ensureRow(group, String(match.home_team || ''))
    const away = ensureRow(group, String(match.away_team || ''))

    if (!home || !away) {
      continue
    }

    if (match.status !== 'finished') {
      continue
    }

    const homeScore = Number(match.home_score)
    const awayScore = Number(match.away_score)

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      continue
    }

    home.goalsFor += homeScore
    home.goalsAgainst += awayScore
    away.goalsFor += awayScore
    away.goalsAgainst += homeScore

    if (homeScore > awayScore) {
      home.points += 3
    } else if (awayScore > homeScore) {
      away.points += 3
    } else {
      home.points += 1
      away.points += 1
    }
  }

  const rankedByGroup = new Map<string, GroupStandingRow[]>()

  for (const [group, rowsMap] of groups.entries()) {
    const ranked = [...rowsMap.values()]
      .map((row) => ({
        ...row,
        goalDiff: row.goalsFor - row.goalsAgainst,
      }))
      .sort(compareStandings)

    rankedByGroup.set(group, ranked)
  }

  applyGroupOverrides(rankedByGroup, overrides)

  const thirdPlaceRows: GroupStandingRow[] = []

  for (const [group, rows] of rankedByGroup.entries()) {
    const third = rows[2]

    if (third) {
      thirdPlaceRows.push({
        ...third,
        group,
      })
    }
  }

  thirdPlaceRows.sort((a, b) => {
    const result = compareStandings(a, b)

    if (result !== 0) {
      return result
    }

    return a.group.localeCompare(b.group)
  })

  return {
    rankedByGroup,
    thirdPlaceRows,
  }
}

export const resolveRound32SeedToken = (
  token: string,
  rankedByGroup: Map<string, GroupStandingRow[]>,
  thirdPlaceRows: GroupStandingRow[],
  usedThirdPlaceGroups: Set<string>,
): string | null => {
  const normalized = canonicalizeSeedToken(token)

  const direct = normalizeDirectSeedToken(normalized)

  if (direct?.[0] && direct[1]) {
    const rank = Number(direct[0])
    const group = direct[1]

    if (!Number.isInteger(rank) || rank < 1) {
      return null
    }

    return rankedByGroup.get(group)?.[rank - 1]?.team || null
  }

  const groupsToken = normalizeBestThirdToken(normalized)

  if (!groupsToken) {
    return null
  }

  const allowedGroups = extractBestThirdGroups(groupsToken) || []

  for (const row of thirdPlaceRows) {
    if (!allowedGroups.includes(row.group)) {
      continue
    }

    if (usedThirdPlaceGroups.has(row.group)) {
      continue
    }

    usedThirdPlaceGroups.add(row.group)
    return row.team
  }

  return null
}

export const getDefaultSeedPairByMatchNumber = (matchNo: number) => {
  const row = BRACKET_DEFINITION[matchNo]

  if (!row) {
    return null
  }

  return {
    home: row.homeSeedToken,
    away: row.awaySeedToken,
  }
}

export const stageForBracketMatchNo = (matchNo: number): MatchStage | null => {
  const row = BRACKET_DEFINITION[matchNo]

  return row?.stage || null
}
