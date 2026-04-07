import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'

type ManualPointsBody = {
  user_id?: string
  points_delta?: number | string
  reason?: string | null
}

const parsePointsDelta = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(parsed) || parsed === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'points_delta invalido (entero distinto de 0)',
    })
  }

  if (parsed < -9999 || parsed > 9999) {
    throw createError({
      statusCode: 400,
      statusMessage: 'points_delta fuera de rango permitido (-9999 a 9999)',
    })
  }

  return parsed
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user, isGlobalAdmin } = await requireAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')

  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  const body = (await readBody(event).catch(() => ({}))) as ManualPointsBody
  const targetUserId = String(body.user_id || '').trim()
  const pointsDelta = parsePointsDelta(body.points_delta)
  const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null

  if (!targetUserId) {
    throw createError({ statusCode: 400, statusMessage: 'user_id es obligatorio' })
  }

  if (reason && reason.length > 240) {
    throw createError({ statusCode: 400, statusMessage: 'reason excede 240 caracteres' })
  }

  const { data: quiniela, error: quinielaError } = await supabase
    .from('quinielas')
    .select('id, admin_id')
    .eq('id', quinielaId)
    .maybeSingle()

  if (quinielaError) {
    throw createError({ statusCode: 500, statusMessage: quinielaError.message })
  }

  if (!quiniela) {
    throw createError({ statusCode: 404, statusMessage: 'Quiniela no encontrada' })
  }

  if (!isGlobalAdmin && quiniela.admin_id !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permisos sobre esta quiniela' })
  }

  const { data: member, error: memberError } = await supabase
    .from('quiniela_members')
    .select('user_id')
    .eq('quiniela_id', quinielaId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (memberError) {
    throw createError({ statusCode: 500, statusMessage: memberError.message })
  }

  if (!member) {
    throw createError({ statusCode: 400, statusMessage: 'El usuario no pertenece a la quiniela' })
  }

  const { data: adjustment, error: adjustmentError } = await supabase
    .from('quiniela_member_manual_points')
    .insert({
      quiniela_id: quinielaId,
      user_id: targetUserId,
      points_delta: pointsDelta,
      reason,
      created_by: user.id,
    })
    .select('id, quiniela_id, user_id, points_delta, reason, created_by, created_at')
    .single()

  if (adjustmentError) {
    throw createError({ statusCode: 500, statusMessage: adjustmentError.message })
  }

  const { data: rankingRow, error: rankingError } = await supabase
    .from('quiniela_rankings')
    .select('quiniela_id, user_id, rank, automatic_points, manual_points, total_points, updated_at')
    .eq('quiniela_id', quinielaId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (rankingError) {
    throw createError({ statusCode: 500, statusMessage: rankingError.message })
  }

  return {
    ok: true,
    adjustment,
    ranking: rankingRow,
  }
})
