import type { MatchStage } from './apiFootball'

export type SimulationSegment =
  | 'all'
  | 'group_stage'
  | 'round_32'
  | 'round_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final'

const GROUP_STAGES: MatchStage[] = [
  'group_a',
  'group_b',
  'group_c',
  'group_d',
  'group_e',
  'group_f',
  'group_g',
  'group_h',
  'group_i',
  'group_j',
  'group_k',
  'group_l',
]

const KNOCKOUT_STAGES: MatchStage[] = [
  'round_32',
  'round_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
]

export const SIMULATION_SEGMENTS: SimulationSegment[] = [
  'all',
  'group_stage',
  'round_32',
  'round_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
]

export function isSimulationSegment(value: string): value is SimulationSegment {
  return SIMULATION_SEGMENTS.includes(value as SimulationSegment)
}

export function getStagesBySegment(segment: SimulationSegment): MatchStage[] {
  if (segment === 'all') {
    return [...GROUP_STAGES, ...KNOCKOUT_STAGES]
  }

  if (segment === 'group_stage') {
    return [...GROUP_STAGES]
  }

  return [segment]
}

export function getSimulationSegmentLabel(segment: SimulationSegment): string {
  const labels: Record<SimulationSegment, string> = {
    all: 'Todo el torneo',
    group_stage: 'Fase de grupos',
    round_32: 'Dieciseisavos',
    round_16: 'Octavos',
    quarter_final: 'Cuartos',
    semi_final: 'Semifinal',
    third_place: 'Tercer lugar',
    final: 'Final',
  }

  return labels[segment]
}
