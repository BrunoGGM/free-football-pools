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

  const { data, error } = await supabase.rpc('admin_preview_quiniela_recalculation', {
    p_quiniela_id: quinielaId,
  })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = ((data as Array<Record<string, any>> | null) ?? []).map((row) => ({
    user_id: String(row.user_id),
    username: String(row.username || 'Jugador'),
    automatic_points_before: Number(row.automatic_points_before ?? 0),
    manual_points: Number(row.manual_points ?? 0),
    total_points_before: Number(row.total_points_before ?? 0),
    rank_before: Number(row.rank_before ?? 0),
    automatic_points_after: Number(row.automatic_points_after ?? 0),
    total_points_after: Number(row.total_points_after ?? 0),
    rank_after: Number(row.rank_after ?? 0),
    delta_points: Number(row.delta_points ?? 0),
  }))

  const summary = {
    total_members: rows.length,
    changed_members: rows.filter((row) => row.delta_points !== 0 || row.rank_before !== row.rank_after).length,
    changed_points: rows.filter((row) => row.delta_points !== 0).length,
    changed_ranks: rows.filter((row) => row.rank_before !== row.rank_after).length,
  }

  return {
    ok: true,
    rows,
    summary,
  }
})