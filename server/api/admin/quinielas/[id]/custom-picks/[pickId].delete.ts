import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../../utils/adminAccess'
import { requireManagedQuiniela } from '../../../../../utils/quinielaAccessTickets'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user, isGlobalAdmin } = await requireAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')
  const pickId = getRouterParam(event, 'pickId')

  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  if (!pickId) {
    throw createError({ statusCode: 400, statusMessage: 'id de pick requerido' })
  }

  await requireManagedQuiniela(supabase, {
    quinielaId,
    userId: user.id,
    isGlobalAdmin,
  })

  const { error: deleteError } = await supabase
    .from('quiniela_custom_picks')
    .delete()
    .eq('id', pickId)
    .eq('quiniela_id', quinielaId)

  if (deleteError) {
    throw createError({ statusCode: 500, statusMessage: deleteError.message })
  }

  return { ok: true, deletedId: pickId }
})
