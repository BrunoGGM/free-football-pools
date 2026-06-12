import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'
import { requireManagedQuiniela } from '../../../../utils/quinielaAccessTickets'

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

  const { data: picks, error: picksError } = await supabase
    .from('quiniela_custom_picks')
    .select(
      'id, quiniela_id, title, description, requires_text, requires_country, points, sort_order, locks_at, created_at, updated_at',
    )
    .eq('quiniela_id', quinielaId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (picksError) {
    throw createError({ statusCode: 500, statusMessage: picksError.message })
  }

  const { data: answers, error: answersError } = await supabase
    .from('quiniela_custom_pick_answers')
    .select(
      'id, custom_pick_id, quiniela_id, user_id, answer_text, answer_country, is_correct, created_at, updated_at',
    )
    .eq('quiniela_id', quinielaId)
    .order('created_at', { ascending: true })

  if (answersError) {
    throw createError({ statusCode: 500, statusMessage: answersError.message })
  }

  const userIds = Array.from(
    new Set((answers || []).map((item: any) => item.user_id).filter(Boolean)),
  )
  const userMap = new Map<string, string>()

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds)

    if (profilesError) {
      throw createError({ statusCode: 500, statusMessage: profilesError.message })
    }

    for (const profile of profiles || []) {
      userMap.set(profile.id as string, (profile.username as string) || 'Jugador')
    }
  }

  return {
    ok: true,
    picks: (picks || []).map((pick: any) => ({
      id: pick.id as string,
      quiniela_id: pick.quiniela_id as string,
      title: pick.title as string,
      description: (pick.description as string | null) || null,
      requires_text: Boolean(pick.requires_text),
      requires_country: Boolean(pick.requires_country),
      points: Number(pick.points || 0),
      sort_order: Number(pick.sort_order || 0),
      locks_at: (pick.locks_at as string | null) || null,
      created_at: pick.created_at as string,
      updated_at: pick.updated_at as string,
    })),
    answers: (answers || []).map((item: any) => ({
      id: item.id as string,
      custom_pick_id: item.custom_pick_id as string,
      quiniela_id: item.quiniela_id as string,
      user_id: item.user_id as string,
      username: userMap.get(item.user_id as string) || 'Jugador',
      answer_text: (item.answer_text as string | null) || null,
      answer_country: (item.answer_country as string | null) || null,
      is_correct: Boolean(item.is_correct),
      created_at: item.created_at as string,
      updated_at: item.updated_at as string,
    })),
  }
})
