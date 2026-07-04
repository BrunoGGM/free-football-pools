import { describe, expect, it } from 'vitest'
import { getEffectiveAwayScore, getEffectiveHomeScore, getEffectiveQualifier } from '../../utils/matchScore'

describe('matchScore helpers', () => {
  it('usa el marcador final de tiempo extra como score efectivo', () => {
    const match = {
      home_score: 2,
      away_score: 2,
      home_extra_time_score: 3,
      away_extra_time_score: 2,
      went_to_extra_time: true,
    }

    expect(getEffectiveHomeScore(match)).toBe(3)
    expect(getEffectiveAwayScore(match)).toBe(2)
    expect(getEffectiveQualifier(match)).toBe('home')
  })

  it('usa penales solo si el marcador efectivo sigue empatado', () => {
    const match = {
      home_score: 1,
      away_score: 1,
      home_extra_time_score: 2,
      away_extra_time_score: 2,
      home_penalty_score: 4,
      away_penalty_score: 3,
      went_to_extra_time: true,
    }

    expect(getEffectiveQualifier(match)).toBe('home')
  })
})