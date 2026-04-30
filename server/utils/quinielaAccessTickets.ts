import { createError, getRequestURL, type H3Event } from 'h3'

export type TicketEffectiveStatus = 'active' | 'expired' | 'revoked'

export function buildTicketJoinUrl(event: H3Event, ticketId: string) {
  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`

  return `${origin}/ingresar?ticket=${encodeURIComponent(ticketId)}`
}

export function getTicketEffectiveStatus(ticket: {
  status: string
  expires_at: string | null
}): TicketEffectiveStatus {
  if (ticket.status === 'revoked') {
    return 'revoked'
  }

  if (ticket.expires_at && new Date(ticket.expires_at).getTime() <= Date.now()) {
    return 'expired'
  }

  return 'active'
}

export function normalizeTicketRecord(event: H3Event, ticket: any) {
  const effectiveStatus = getTicketEffectiveStatus(ticket)

  return {
    id: ticket.id as string,
    quiniela_id: ticket.quiniela_id as string,
    label: (ticket.label as string | null) || null,
    status: ticket.status as string,
    effective_status: effectiveStatus,
    expires_at: (ticket.expires_at as string | null) || null,
    redeemed_count: Number(ticket.redeemed_count || 0),
    last_redeemed_at: (ticket.last_redeemed_at as string | null) || null,
    created_by: (ticket.created_by as string | null) || null,
    revoked_by: (ticket.revoked_by as string | null) || null,
    revoked_at: (ticket.revoked_at as string | null) || null,
    created_at: ticket.created_at as string,
    updated_at: ticket.updated_at as string,
    join_url: buildTicketJoinUrl(event, ticket.id as string),
  }
}

export async function requireManagedQuiniela(
  supabase: any,
  options: {
    quinielaId: string
    userId: string
    isGlobalAdmin: boolean
  },
) {
  const { data: quiniela, error } = await supabase
    .from('quinielas')
    .select('id, name, admin_id, end_date, has_test_data')
    .eq('id', options.quinielaId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!quiniela) {
    throw createError({ statusCode: 404, statusMessage: 'Quiniela no encontrada' })
  }

  if (!options.isGlobalAdmin && quiniela.admin_id !== options.userId) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permisos sobre esta quiniela' })
  }

  return quiniela
}
