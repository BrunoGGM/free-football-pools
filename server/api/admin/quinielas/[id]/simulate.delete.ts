import { createError, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../../../utils/adminAccess'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireGlobalAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')?.trim()

  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  const { data: quiniela, error: quinielaError } = await supabase
    .from('quinielas')
    .select('id, name')
    .eq('id', quinielaId)
    .maybeSingle()

  if (quinielaError) {
    throw createError({ statusCode: 500, statusMessage: quinielaError.message })
  }

  if (!quiniela) {
    throw createError({ statusCode: 404, statusMessage: 'Quiniela no encontrada' })
  }

  const { error: predictionsDeleteError } = await supabase
    .from('predictions')
    .delete()
    .eq('quiniela_id', quinielaId)
    .eq('is_test_record', true)

  if (predictionsDeleteError) {
    throw createError({ statusCode: 500, statusMessage: predictionsDeleteError.message })
  }

  const { error: membersDeleteError } = await supabase
    .from('quiniela_members')
    .delete()
    .eq('quiniela_id', quinielaId)
    .eq('is_test_record', true)

  if (membersDeleteError) {
    throw createError({ statusCode: 500, statusMessage: membersDeleteError.message })
  }

  const { error: recalcError } = await supabase.rpc('recalculate_quiniela_scoring', {
    p_quiniela_id: quinielaId,
  })

  if (recalcError) {
    throw createError({ statusCode: 500, statusMessage: recalcError.message })
  }

  const { data: refreshed, error: refreshedError } = await supabase
    .from('quinielas')
    .select('id, has_test_data')
    .eq('id', quinielaId)
    .maybeSingle()

  if (refreshedError) {
    throw createError({ statusCode: 500, statusMessage: refreshedError.message })
  }

  return {
    ok: true,
    quiniela: {
      id: quiniela.id,
      name: quiniela.name,
      has_test_data: Boolean(refreshed?.has_test_data),
    },
  }
})
