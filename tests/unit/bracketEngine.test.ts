import { describe, expect, it } from 'vitest'
import {
  canonicalizeSeedToken,
  computeGroupRankings,
  getDefaultSeedPairByMatchNumber,
  isGenericSeedToken,
  isRound32SeedToken,
  resolveRound32SeedToken,
  stageForBracketMatchNo,
} from '../../server/utils/bracketEngine'

type MatchRow = {
  stage: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'finished'
}

const GROUP_MATCHES: MatchRow[] = [
  { stage: 'group_a', home_team: 'Alpha', away_team: 'Bravo', home_score: 2, away_score: 0, status: 'finished' },
  { stage: 'group_a', home_team: 'Charlie', away_team: 'Delta', home_score: 0, away_score: 0, status: 'finished' },
  { stage: 'group_a', home_team: 'Alpha', away_team: 'Charlie', home_score: 0, away_score: 1, status: 'finished' },
  { stage: 'group_a', home_team: 'Bravo', away_team: 'Delta', home_score: 1, away_score: 0, status: 'finished' },
  { stage: 'group_a', home_team: 'Alpha', away_team: 'Delta', home_score: 1, away_score: 1, status: 'finished' },
  { stage: 'group_a', home_team: 'Bravo', away_team: 'Charlie', home_score: 0, away_score: 2, status: 'finished' },
  { stage: 'group_b', home_team: 'Echo', away_team: 'Foxtrot', home_score: 1, away_score: 0, status: 'finished' },
  { stage: 'group_b', home_team: 'Golf', away_team: 'Hotel', home_score: 2, away_score: 0, status: 'finished' },
  { stage: 'group_b', home_team: 'Echo', away_team: 'Golf', home_score: 0, away_score: 0, status: 'finished' },
  { stage: 'group_b', home_team: 'Foxtrot', away_team: 'Hotel', home_score: 0, away_score: 0, status: 'finished' },
  { stage: 'group_b', home_team: 'Echo', away_team: 'Hotel', home_score: 1, away_score: 0, status: 'finished' },
  { stage: 'group_b', home_team: 'Foxtrot', away_team: 'Golf', home_score: 0, away_score: 1, status: 'finished' },
]

describe('bracketEngine token helpers', () => {
  it('canonicaliza tokens de seed y respeta texto libre', () => {
    expect(canonicalizeSeedToken(' 2a ')).toBe('2A')
    expect(canonicalizeSeedToken('Mejor 3ro ( a / c / d )')).toBe('3rd(A/C/D)')
    expect(canonicalizeSeedToken(' w074 ')).toBe('W74')
    expect(canonicalizeSeedToken('L101')).toBe('L101')
    expect(canonicalizeSeedToken('Argentina')).toBe('Argentina')
  })

  it('detecta seeds validos para R32', () => {
    expect(isRound32SeedToken('1A')).toBe(true)
    expect(isRound32SeedToken('2L')).toBe(true)
    expect(isRound32SeedToken('3rd(A/B/C)')).toBe(true)
    expect(isRound32SeedToken('Mejor 3ro A/B')).toBe(true)
    expect(isRound32SeedToken('3A')).toBe(false)
    expect(isRound32SeedToken('W74')).toBe(false)
  })

  it('detecta seeds genericos', () => {
    expect(isGenericSeedToken('1B')).toBe(true)
    expect(isGenericSeedToken('3rd(B/C)')).toBe(true)
    expect(isGenericSeedToken('W89')).toBe(true)
    expect(isGenericSeedToken('L101')).toBe(true)
    expect(isGenericSeedToken('Mexico')).toBe(false)
  })
})

describe('bracketEngine rankings y resolucion', () => {
  it('calcula ranking de grupos y mejores terceros', () => {
    const { rankedByGroup, thirdPlaceRows } = computeGroupRankings(GROUP_MATCHES)

    expect(rankedByGroup.get('A')?.map((row) => row.team)).toEqual(['Charlie', 'Alpha', 'Bravo', 'Delta'])
    expect(rankedByGroup.get('B')?.map((row) => row.team)).toEqual(['Golf', 'Echo', 'Foxtrot', 'Hotel'])
    expect(thirdPlaceRows.map((row) => row.team)).toEqual(['Bravo', 'Foxtrot'])
  })

  it('aplica overrides manuales de grupo', () => {
    const { rankedByGroup, thirdPlaceRows } = computeGroupRankings(GROUP_MATCHES, [
      { group_code: 'a', position: 1, team_name: 'Bravo' },
      { group_code: 'A', position: 2, team_name: 'Alpha' },
    ])

    expect(rankedByGroup.get('A')?.map((row) => row.team)).toEqual(['Bravo', 'Alpha', 'Charlie', 'Delta'])
    expect(thirdPlaceRows.map((row) => row.team)).toEqual(['Charlie', 'Foxtrot'])
  })

  it('resuelve tokens directos y mejores terceros sin repetir grupo', () => {
    const { rankedByGroup, thirdPlaceRows } = computeGroupRankings(GROUP_MATCHES)
    const usedThirdGroups = new Set<string>()

    expect(resolveRound32SeedToken('1A', rankedByGroup, thirdPlaceRows, usedThirdGroups)).toBe('Charlie')
    expect(resolveRound32SeedToken('3rd(A/B)', rankedByGroup, thirdPlaceRows, usedThirdGroups)).toBe('Bravo')
    expect(resolveRound32SeedToken('3rd(A/B)', rankedByGroup, thirdPlaceRows, usedThirdGroups)).toBe('Foxtrot')
    expect(resolveRound32SeedToken('3rd(A/B)', rankedByGroup, thirdPlaceRows, usedThirdGroups)).toBe(null)
  })
})

describe('bracketEngine helpers por match number', () => {
  it('retorna seeds por numero de partido y stage', () => {
    expect(getDefaultSeedPairByMatchNumber(73)).toEqual({ home: '2A', away: '2B' })
    expect(getDefaultSeedPairByMatchNumber(104)).toEqual({ home: 'W101', away: 'W102' })
    expect(getDefaultSeedPairByMatchNumber(999)).toBe(null)

    expect(stageForBracketMatchNo(103)).toBe('third_place')
    expect(stageForBracketMatchNo(104)).toBe('final')
    expect(stageForBracketMatchNo(999)).toBe(null)
  })
})
