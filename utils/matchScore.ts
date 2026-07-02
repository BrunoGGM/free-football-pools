export type MatchScoreLike = {
  home_score: number | null
  away_score: number | null
  home_extra_time_score?: number | null
  away_extra_time_score?: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
  went_to_extra_time?: boolean | null
}

export const getEffectiveHomeScore = (match: MatchScoreLike): number | null => {
  if (
    match.went_to_extra_time === true &&
    match.home_extra_time_score !== null &&
    match.home_extra_time_score !== undefined &&
    match.away_extra_time_score !== null &&
    match.away_extra_time_score !== undefined
  ) {
    return match.home_extra_time_score
  }

  return match.home_score ?? null
}

export const getEffectiveAwayScore = (match: MatchScoreLike): number | null => {
  if (
    match.went_to_extra_time === true &&
    match.home_extra_time_score !== null &&
    match.home_extra_time_score !== undefined &&
    match.away_extra_time_score !== null &&
    match.away_extra_time_score !== undefined
  ) {
    return match.away_extra_time_score
  }

  return match.away_score ?? null
}

export const getEffectiveQualifier = (
  match: MatchScoreLike,
): 'home' | 'away' | null => {
  const homeScore = getEffectiveHomeScore(match)
  const awayScore = getEffectiveAwayScore(match)

  if (homeScore === null || awayScore === null) {
    return null
  }

  if (homeScore > awayScore) {
    return 'home'
  }

  if (homeScore < awayScore) {
    return 'away'
  }

  if (
    match.home_penalty_score !== null &&
    match.home_penalty_score !== undefined &&
    match.away_penalty_score !== null &&
    match.away_penalty_score !== undefined
  ) {
    if (match.home_penalty_score > match.away_penalty_score) {
      return 'home'
    }

    if (match.home_penalty_score < match.away_penalty_score) {
      return 'away'
    }
  }

  return null
}
