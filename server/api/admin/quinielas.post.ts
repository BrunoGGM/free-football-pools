import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../utils/adminAccess'

type CreateQuinielaBody = {
  name?: string
  description?: string | null
  access_code?: string
  start_date?: string
  end_date?: string | null
  admin_id?: string
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user } = await requireGlobalAdminAccess(event, supabase)
  const body = (await readBody(event).catch(() => ({}))) as CreateQuinielaBody

  const name = (body.name || '').trim()
  const accessCode = (body.access_code || '').trim().toUpperCase()
  const description = body.description?.trim() || null
  const startDate = body.start_date || null
  const endDate = body.end_date || null
  const adminId = (body.admin_id || user.id).trim()

  if (name.length < 3 || name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Nombre invalido (3 a 120 caracteres)' })
  }

  if (!/^[A-Z0-9]{6,12}$/.test(accessCode)) {
    throw createError({ statusCode: 400, statusMessage: 'Access code invalido (6 a 12 alfanumericos)' })
  }

  if (!startDate) {
    throw createError({ statusCode: 400, statusMessage: 'start_date es obligatorio' })
  }

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

  const { data, error } = await supabase
    .from('quinielas')
    .insert({
      name,
      description,
      access_code: accessCode,
      start_date: startDate,
      end_date: endDate,
      admin_id: adminId,
    })
    .select('id, name, access_code, admin_id, start_date, end_date')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('quiniela_members').upsert(
    {
      user_id: adminId,
      quiniela_id: data.id,
    },
    { onConflict: 'user_id,quiniela_id' },
  )

  return {
    ok: true,
    quiniela: data,
  }
})
