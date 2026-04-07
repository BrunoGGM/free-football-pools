import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../../utils/adminAccess'

type UpdateQuinielaBody = {
  name?: string
  description?: string | null
  access_code?: string
  start_date?: string
  end_date?: string | null
  admin_id?: string
  champion_team?: string | null
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireGlobalAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')
  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  const body = (await readBody(event).catch(() => ({}))) as UpdateQuinielaBody

  const payload: Record<string, any> = {}

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

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No hay campos para actualizar' })
  }

  const { data, error } = await supabase
    .from('quinielas')
    .update(payload)
    .eq('id', quinielaId)
    .select('id, name, access_code, admin_id, start_date, end_date')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
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
    quiniela: data,
  }
})
