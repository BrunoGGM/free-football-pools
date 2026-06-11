import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'
import { requireManagedQuiniela } from '../../../../utils/quinielaAccessTickets'

type AnswerUpdate = {
  answer_id?: string
  is_correct?: boolean
}

type AnswersPatchBody = {
  updates?: AnswerUpdate[]
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user, isGlobalAdmin } = await requireAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')
  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  await requireManagedQuiniela(supabase, {
    quinielaId,
    userId: user.id,
    isGlobalAdmin,
  })

  const body = (await readBody(event).catch(() => ({}))) as AnswersPatchBody
  const updates = Array.isArray(body.updates) ? body.updates : []

  if (updates.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No hay respuestas para actualizar' })
  }

  if (updates.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Demasiadas respuestas en una sola peticion' })
  }

  const normalized = updates
    .map((item) => ({
      answer_id: String(item.answer_id || '').trim(),
      is_correct: Boolean(item.is_correct),
    }))
    .filter((item) => item.answer_id)

  if (normalized.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'answer_id es obligatorio' })
  }

  const answerIds = normalized.map((item) => item.answer_id)

  // Ensure all answers belong to this quiniela before mutating.
  const { data: existing, error: existingError } = await supabase
    .from('quiniela_custom_pick_answers')
    .select('id')
    .eq('quiniela_id', quinielaId)
    .in('id', answerIds)

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  const validIds = new Set((existing || []).map((item: any) => item.id as string))

  for (const update of normalized) {
    if (!validIds.has(update.answer_id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Alguna respuesta no pertenece a esta quiniela',
      })
    }
  }

  for (const update of normalized) {
    const { error: updateError } = await supabase
      .from('quiniela_custom_pick_answers')
      .update({ is_correct: update.is_correct })
      .eq('id', update.answer_id)
      .eq('quiniela_id', quinielaId)

    if (updateError) {
      throw createError({ statusCode: 500, statusMessage: updateError.message })
    }
  }

  return { ok: true, updated: normalized.length }
})
