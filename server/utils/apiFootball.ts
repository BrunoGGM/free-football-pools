export type MatchStatus = 'pending' | 'in_progress' | 'finished'
export type MatchStage =
  | 'group_a'
  | 'group_b'
  | 'group_c'
  | 'group_d'
  | 'group_e'
  | 'group_f'
  | 'group_g'
  | 'group_h'
  | 'group_i'
  | 'group_j'
  | 'group_k'
  | 'group_l'
  | 'round_32'
  | 'round_16'
  | 'quarter_final'
  | 'semi_final'
  | 'final'

const FINISHED_CODES = new Set(['FT', 'AET', 'PEN'])
const IN_PROGRESS_CODES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'SUSP', 'LIVE'])

export function normalizeApiFootballStatus(statusShort: string | null | undefined): MatchStatus {
  const code = (statusShort || '').toUpperCase().trim()

  if (FINISHED_CODES.has(code)) {
    return 'finished'
  }

  if (IN_PROGRESS_CODES.has(code)) {
    return 'in_progress'
  }

  return 'pending'
}

export function normalizeApiFootballStage(round: string | null | undefined): MatchStage | null {
  const value = (round || '').toLowerCase().trim()

  if (!value) {
    return null
  }

  const groupMatch = value.match(/group\s*([a-l])\b/i)
  if (groupMatch?.[1]) {
    return `group_${groupMatch[1].toLowerCase()}` as MatchStage
  }

  if (/round\s*of\s*32|32nd|1\/16/.test(value)) {
    return 'round_32'
  }

  if (/round\s*of\s*16|1\/8|eighth/.test(value)) {
    return 'round_16'
  }

  if (/quarter/.test(value)) {
    return 'quarter_final'
  }

  if (/semi/.test(value)) {
    return 'semi_final'
  }

  if (/\bfinal\b/.test(value)) {
    return 'final'
  }

  return null
}

export function formatUtcDate(input: Date): string {
  return input.toISOString().slice(0, 10)
}

export function formatTimeInTimeZone(
  input: string | Date,
  timeZone: string = 'America/New_York',
): string | null {
  const date = input instanceof Date ? input : new Date(input)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const hh = byType.hour || '00'
  const mm = byType.minute || '00'
  const ss = byType.second || '00'

  return `${hh}:${mm}:${ss}`
}
