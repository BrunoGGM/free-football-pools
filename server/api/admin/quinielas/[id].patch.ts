import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../utils/adminAccess'
import {
  DEFAULT_QUINIELA_RULES,
  hasRulePayloadChanges,
  parseQuinielaRulesInput,
  type QuinielaRulesPayload,
} from '../../../utils/quinielaRules'

type UpdateQuinielaBody = {
  name?: string
  description?: string | null
  access_code?: string
  start_date?: string
  end_date?: string | null
  admin_id?: string
  champion_team?: string | null
  ticket_price?: number | string
  exact_score_points?: number | string
  correct_outcome_points?: number | string
  champion_bonus_points?: number | string
  exact_hit_min_points?: number | string
  streak_hit_min_points?: number | string
  streak_bonus_3_points?: number | string
  streak_bonus_5_points?: number | string
  allow_member_predictions_view?: boolean | string | number
}

const parseTicketPrice = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createError({ statusCode: 400, statusMessage: 'ticket_price invalido (debe ser numero >= 0)' })
  }

  return Number(parsed.toFixed(2))
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user, isGlobalAdmin } = await requireAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')
  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  const { data: targetQuiniela, error: targetQuinielaError } = await supabase
    .from('quinielas')
    .select('id, admin_id')
    .eq('id', quinielaId)
    .maybeSingle()

  if (targetQuinielaError) {
    throw createError({ statusCode: 500, statusMessage: targetQuinielaError.message })
  }

  if (!targetQuiniela) {
    throw createError({ statusCode: 404, statusMessage: 'Quiniela no encontrada' })
  }

  if (!isGlobalAdmin && targetQuiniela.admin_id !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permisos sobre esta quiniela' })
  }

  const body = (await readBody(event).catch(() => ({}))) as UpdateQuinielaBody

  const payload: Record<string, any> = {}
  const rawRuleInput = {
    exact_score_points: body.exact_score_points,
    correct_outcome_points: body.correct_outcome_points,
    champion_bonus_points: body.champion_bonus_points,
    exact_hit_min_points: body.exact_hit_min_points,
    streak_hit_min_points: body.streak_hit_min_points,
    streak_bonus_3_points: body.streak_bonus_3_points,
    streak_bonus_5_points: body.streak_bonus_5_points,
    allow_member_predictions_view: body.allow_member_predictions_view,
  }

  if (typeof body.name === 'string') {
    const value = body.name.trim()
    if (value.length < 3 || value.length > 120) {
      throw createError({ statusCode: 400, statusMessage: 'Nombre invalido (3 a 120 caracteres)' })
    }
    payload.name = value
  }

  if (typeof body.description === 'string') {
    payload.description = body.description.trim() || null
  }

  if (body.description === null) {
    payload.description = null
  }

  if (typeof body.access_code === 'string') {
    const value = body.access_code.trim().toUpperCase()
    if (!/^[A-Z0-9]{6,12}$/.test(value)) {
      throw createError({ statusCode: 400, statusMessage: 'Access code invalido (6 a 12 alfanumericos)' })
    }
    payload.access_code = value
  }

  if (typeof body.start_date === 'string') {
    payload.start_date = body.start_date
  }

  if (typeof body.end_date === 'string') {
    payload.end_date = body.end_date
  }

  if (body.end_date === null) {
    payload.end_date = null
  }

  if (typeof body.admin_id === 'string') {
    if (!isGlobalAdmin) {
      throw createError({ statusCode: 403, statusMessage: 'Solo global admin puede reasignar admin_id' })
    }

    const adminId = body.admin_id.trim()
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', adminId)
      .maybeSingle()

    if (adminProfileError) {
      throw createError({ statusCode: 500, statusMessage: adminProfileError.message })
    }

    if (!adminProfile) {
      throw createError({ statusCode: 400, statusMessage: 'admin_id no existe en profiles' })
    }

    payload.admin_id = adminId
  }

  if (typeof body.champion_team === 'string') {
    payload.champion_team = body.champion_team.trim() || null
  }

  if (body.champion_team === null) {
    payload.champion_team = null
  }

  if (body.ticket_price !== undefined) {
    payload.ticket_price = parseTicketPrice(body.ticket_price)
  }

  let mergedRules: QuinielaRulesPayload | null = null

  const hasIncomingRuleValues = Object.values(rawRuleInput).some((value) => value !== undefined)

  if (hasIncomingRuleValues) {
    const { data: currentRules, error: currentRulesError } = await supabase
      .from('quiniela_rules')
      .select('exact_score_points, correct_outcome_points, champion_bonus_points, exact_hit_min_points, streak_hit_min_points, streak_bonus_3_points, streak_bonus_5_points, allow_member_predictions_view')
      .eq('quiniela_id', quinielaId)
      .maybeSingle()

    if (currentRulesError && currentRulesError.code === '42P01') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Reglas no disponibles aun. Aplica la migracion 0017.',
      })
    }

    if (currentRulesError) {
      throw createError({ statusCode: 500, statusMessage: currentRulesError.message })
    }

    const baseRules: QuinielaRulesPayload = currentRules
      ? {
        exact_score_points: Number(currentRules.exact_score_points),
        correct_outcome_points: Number(currentRules.correct_outcome_points),
        champion_bonus_points: Number(currentRules.champion_bonus_points),
        exact_hit_min_points: Number(currentRules.exact_hit_min_points),
        streak_hit_min_points: Number(currentRules.streak_hit_min_points),
        streak_bonus_3_points: Number(currentRules.streak_bonus_3_points),
        streak_bonus_5_points: Number(currentRules.streak_bonus_5_points),
        allow_member_predictions_view: Boolean(
          currentRules.allow_member_predictions_view,
        ),
      }
      : DEFAULT_QUINIELA_RULES

    const { parsed: parsedRuleChanges, merged } = parseQuinielaRulesInput(rawRuleInput, {
      base: baseRules,
    })

    mergedRules = merged

    if (hasRulePayloadChanges(parsedRuleChanges)) {
      const { error: rulesError } = await supabase
        .from('quiniela_rules')
        .upsert({
          quiniela_id: quinielaId,
          ...parsedRuleChanges,
        }, { onConflict: 'quiniela_id' })

      if (rulesError) {
        throw createError({ statusCode: 500, statusMessage: rulesError.message })
      }

      const { error: recalcError } = await supabase
        .rpc('recalculate_quiniela_scoring', {
          p_quiniela_id: quinielaId,
        })

      if (recalcError) {
        throw createError({ statusCode: 500, statusMessage: recalcError.message })
      }
    }
  }

  if (Object.keys(payload).length === 0 && !hasIncomingRuleValues) {
    throw createError({ statusCode: 400, statusMessage: 'No hay campos para actualizar' })
  }

  let data: any = null

  if (Object.keys(payload).length > 0) {
    const result = await supabase
      .from('quinielas')
      .update(payload)
      .eq('id', quinielaId)
      .select('id, name, access_code, admin_id, start_date, end_date, ticket_price')
      .single()

    data = result.data

    if (result.error) {
      throw createError({ statusCode: 500, statusMessage: result.error.message })
    }
  } else {
    const result = await supabase
      .from('quinielas')
      .select('id, name, access_code, admin_id, start_date, end_date, ticket_price')
      .eq('id', quinielaId)
      .single()

    data = result.data

    if (result.error) {
      throw createError({ statusCode: 500, statusMessage: result.error.message })
    }
  }

  if (payload.admin_id) {
    await supabase.from('quiniela_members').upsert(
      {
        user_id: payload.admin_id,
        quiniela_id: quinielaId,
      },
      { onConflict: 'user_id,quiniela_id' },
    )
  }

  return {
    ok: true,
    quiniela: {
      ...data,
      ...(mergedRules
        ? {
          rules: mergedRules,
        }
        : {}),
    },
  }
})
