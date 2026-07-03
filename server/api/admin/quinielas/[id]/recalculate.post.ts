import { createError, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user, isGlobalAdmin } = await requireAdminAccess(event, supabase)
  const quinielaId = getRouterParam(event, 'id')?.trim()

  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  if (!isGlobalAdmin) {
    const { data: quiniela, error: qError } = await supabase
      .from('quinielas')
      .select('admin_id')
      .eq('id', quinielaId)
      .maybeSingle()

    if (qError) {
      throw createError({ statusCode: 500, statusMessage: qError.message })
    }

    if (!quiniela || quiniela.admin_id !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'No tienes permisos para esta quiniela' })
    }
  }

  const { data: previewData, error: previewError } = await supabase.rpc('admin_preview_quiniela_recalculation', {
    p_quiniela_id: quinielaId,
  })

  if (previewError) {
    throw createError({ statusCode: 500, statusMessage: previewError.message })
  }

  const previewRows = ((previewData as Array<Record<string, any>> | null) ?? []).map((row) => ({
    delta_points: Number(row.delta_points ?? 0),
    rank_before: Number(row.rank_before ?? 0),
    rank_after: Number(row.rank_after ?? 0),
  }))

  const { error: recalcError } = await supabase.rpc('recalculate_quiniela_scoring', {
    p_quiniela_id: quinielaId,
  })

  if (recalcError) {
    throw createError({ statusCode: 500, statusMessage: recalcError.message })
  }

  return {
    ok: true,
    summary: {
      total_members: previewRows.length,
      changed_members: previewRows.filter((row) => row.delta_points !== 0 || row.rank_before !== row.rank_after).length,
      changed_points: previewRows.filter((row) => row.delta_points !== 0).length,
      changed_ranks: previewRows.filter((row) => row.rank_before !== row.rank_after).length,
    },
  }
})