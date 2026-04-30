import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'
import {
  normalizeTicketRecord,
  requireManagedQuiniela,
} from '../../../../utils/quinielaAccessTickets'

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

  const { data: tickets, error: ticketsError } = await supabase
    .from('quiniela_access_tickets')
    .select('id, quiniela_id, label, status, expires_at, redeemed_count, last_redeemed_at, created_by, revoked_by, revoked_at, created_at, updated_at')
    .eq('quiniela_id', quinielaId)
    .order('created_at', { ascending: false })
    .limit(40)

  if (ticketsError) {
    throw createError({ statusCode: 500, statusMessage: ticketsError.message })
  }

  const { data: redemptions, error: redemptionsError } = await supabase
    .from('quiniela_access_ticket_redemptions')
    .select('id, ticket_id, quiniela_id, user_id, status, message, created_at')
    .eq('quiniela_id', quinielaId)
    .order('created_at', { ascending: false })
    .limit(80)

  if (redemptionsError) {
    throw createError({ statusCode: 500, statusMessage: redemptionsError.message })
  }

  const userIds = Array.from(new Set((redemptions || []).map((item: any) => item.user_id).filter(Boolean)))
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
    tickets: (tickets || []).map((ticket: any) => normalizeTicketRecord(event, ticket)),
    redemptions: (redemptions || []).map((item: any) => ({
      id: item.id as string,
      ticket_id: (item.ticket_id as string | null) || null,
      quiniela_id: (item.quiniela_id as string | null) || null,
      user_id: (item.user_id as string | null) || null,
      username: item.user_id ? userMap.get(item.user_id as string) || 'Jugador' : 'Jugador',
      status: item.status as string,
      message: (item.message as string | null) || null,
      created_at: item.created_at as string,
    })),
  }
})
