import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../../utils/adminAccess'
import {
  normalizeTicketRecord,
  requireManagedQuiniela,
} from '../../../../../utils/quinielaAccessTickets'

type UpdateTicketBody = {
  action?: 'expire' | 'reopen'
  expires_at?: string | null
}

const parseFutureDateOrNull = (value: unknown) => {
  if (value === null) {
    return null
  }

  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    return null
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'expires_at invalido' })
  }

  if (date.getTime() <= Date.now()) {
    throw createError({ statusCode: 400, statusMessage: 'expires_at debe ser futura' })
  }

  return date.toISOString()
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user, isGlobalAdmin } = await requireAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')
  const ticketId = getRouterParam(event, 'ticketId')

  if (!quinielaId || !ticketId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela y boleto requeridos' })
  }

  await requireManagedQuiniela(supabase, {
    quinielaId,
    userId: user.id,
    isGlobalAdmin,
  })

  const { data: currentTicket, error: ticketError } = await supabase
    .from('quiniela_access_tickets')
    .select('id, quiniela_id')
    .eq('id', ticketId)
    .eq('quiniela_id', quinielaId)
    .maybeSingle()

  if (ticketError) {
    throw createError({ statusCode: 500, statusMessage: ticketError.message })
  }

  if (!currentTicket) {
    throw createError({ statusCode: 404, statusMessage: 'Boleto no encontrado' })
  }

  const body = (await readBody(event).catch(() => ({}))) as UpdateTicketBody
  const action = body.action || 'expire'
  const payload: Record<string, unknown> = {}

  if (action === 'expire') {
    payload.status = 'revoked'
    payload.revoked_at = new Date().toISOString()
    payload.revoked_by = user.id
  } else if (action === 'reopen') {
    payload.status = 'active'
    payload.revoked_at = null
    payload.revoked_by = null
    payload.expires_at = parseFutureDateOrNull(body.expires_at)
  } else {
    throw createError({ statusCode: 400, statusMessage: 'action invalida' })
  }

  const { data: updatedTicket, error: updateError } = await supabase
    .from('quiniela_access_tickets')
    .update(payload)
    .eq('id', ticketId)
    .eq('quiniela_id', quinielaId)
    .select('id, quiniela_id, label, status, expires_at, redeemed_count, last_redeemed_at, created_by, revoked_by, revoked_at, created_at, updated_at')
    .single()

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }

  return {
    ok: true,
    ticket: normalizeTicketRecord(event, updatedTicket),
  }
})
