import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../../utils/adminAccess'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireGlobalAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')
  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  const { error } = await supabase
    .from('quinielas')
    .delete()
    .eq('id', quinielaId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    ok: true,
    deletedId: quinielaId,
  }
})
