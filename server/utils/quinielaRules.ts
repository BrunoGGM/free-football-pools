import { createError } from 'h3'

export const DEFAULT_QUINIELA_RULES = {
  exact_score_points: 3,
  correct_outcome_points: 1,
  champion_bonus_points: 10,
  exact_hit_min_points: 3,
  streak_hit_min_points: 1,
  streak_bonus_3_points: 1,
  streak_bonus_5_points: 2,
  allow_member_predictions_view: false,
} as const

const RULE_BOUNDS = {
  exact_score_points: { min: 1, max: 20 },
  correct_outcome_points: { min: 0, max: 20 },
  champion_bonus_points: { min: 0, max: 100 },
  exact_hit_min_points: { min: 1, max: 20 },
  streak_hit_min_points: { min: 1, max: 20 },
  streak_bonus_3_points: { min: 0, max: 20 },
  streak_bonus_5_points: { min: 0, max: 20 },
} as const

type NumericRuleField = keyof typeof RULE_BOUNDS

export type QuinielaRulesPayload = {
  exact_score_points: number
  correct_outcome_points: number
  champion_bonus_points: number
  exact_hit_min_points: number
  streak_hit_min_points: number
  streak_bonus_3_points: number
  streak_bonus_5_points: number
  allow_member_predictions_view: boolean
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return true
}

const parseRuleInt = (
  field: NumericRuleField,
  value: unknown,
  required: boolean,
): number | undefined => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createError({ statusCode: 400, statusMessage: `${field} es obligatorio` })
    }

    return undefined
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw createError({ statusCode: 400, statusMessage: `${field} invalido (debe ser entero)` })
  }

  const { min, max } = RULE_BOUNDS[field]

  if (parsed < min || parsed > max) {
    throw createError({
      statusCode: 400,
      statusMessage: `${field} fuera de rango (${min} a ${max})`,
    })
  }

  return parsed
}

const parseRuleBoolean = (
  field: 'allow_member_predictions_view',
  value: unknown,
): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true
    }

    if (value === 0) {
      return false
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (['true', '1', 'si', 'sí', 'yes', 'on'].includes(normalized)) {
      return true
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false
    }
  }

  throw createError({ statusCode: 400, statusMessage: `${field} invalido (debe ser booleano)` })
}

const validateRulesConsistency = (rules: QuinielaRulesPayload) => {
  if (rules.correct_outcome_points > rules.exact_score_points) {
    throw createError({
      statusCode: 400,
      statusMessage: 'correct_outcome_points no puede ser mayor que exact_score_points',
    })
  }

  if (rules.exact_hit_min_points > rules.exact_score_points) {
    throw createError({
      statusCode: 400,
      statusMessage: 'exact_hit_min_points no puede ser mayor que exact_score_points',
    })
  }

  if (rules.streak_hit_min_points > rules.exact_score_points) {
    throw createError({
      statusCode: 400,
      statusMessage: 'streak_hit_min_points no puede ser mayor que exact_score_points',
    })
  }
}

export const parseQuinielaRulesInput = (
  input: unknown,
  options: {
    requireAll?: boolean
    base?: QuinielaRulesPayload
  } = {},
): {
  parsed: Partial<QuinielaRulesPayload>
  merged: QuinielaRulesPayload
} => {
  const source = isPlainObject(input) ? input : {}
  const requireAll = options.requireAll === true
  const base = options.base || DEFAULT_QUINIELA_RULES

  const parsed: Partial<QuinielaRulesPayload> = {
    exact_score_points: parseRuleInt('exact_score_points', source.exact_score_points, requireAll),
    correct_outcome_points: parseRuleInt('correct_outcome_points', source.correct_outcome_points, requireAll),
    champion_bonus_points: parseRuleInt('champion_bonus_points', source.champion_bonus_points, requireAll),
    exact_hit_min_points: parseRuleInt('exact_hit_min_points', source.exact_hit_min_points, requireAll),
    streak_hit_min_points: parseRuleInt('streak_hit_min_points', source.streak_hit_min_points, requireAll),
    streak_bonus_3_points: parseRuleInt('streak_bonus_3_points', source.streak_bonus_3_points, requireAll),
    streak_bonus_5_points: parseRuleInt('streak_bonus_5_points', source.streak_bonus_5_points, requireAll),
    allow_member_predictions_view: parseRuleBoolean(
      'allow_member_predictions_view',
      source.allow_member_predictions_view,
    ),
  }

  const cleanedParsed = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined),
  ) as Partial<QuinielaRulesPayload>

  const merged: QuinielaRulesPayload = {
    exact_score_points: cleanedParsed.exact_score_points ?? base.exact_score_points,
    correct_outcome_points: cleanedParsed.correct_outcome_points ?? base.correct_outcome_points,
    champion_bonus_points: cleanedParsed.champion_bonus_points ?? base.champion_bonus_points,
    exact_hit_min_points: cleanedParsed.exact_hit_min_points ?? base.exact_hit_min_points,
    streak_hit_min_points: cleanedParsed.streak_hit_min_points ?? base.streak_hit_min_points,
    streak_bonus_3_points: cleanedParsed.streak_bonus_3_points ?? base.streak_bonus_3_points,
    streak_bonus_5_points: cleanedParsed.streak_bonus_5_points ?? base.streak_bonus_5_points,
    allow_member_predictions_view:
      cleanedParsed.allow_member_predictions_view ?? base.allow_member_predictions_view,
  }

  validateRulesConsistency(merged)

  return {
    parsed: cleanedParsed,
    merged,
  }
}

export const hasRulePayloadChanges = (rules: Partial<QuinielaRulesPayload>) => {
  return Object.keys(rules).length > 0
}
