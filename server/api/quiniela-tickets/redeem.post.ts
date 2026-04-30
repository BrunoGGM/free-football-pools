import { createError, getHeader, readBody } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { getTicketEffectiveStatus } from '../../utils/quinielaAccessTickets'

type RedeemTicketBody = {
  ticket_id?: string
  ticket?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function resolveUser(event: any, supabase: any) {
  try {
    const cookieUser = await serverSupabaseUser(event)
    if (cookieUser) {
      return cookieUser
    }
  } catch {
    // Bearer fallback below.
  }

  const authHeader = getHeader(event, 'authorization') || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return null
  }

  return data.user
}

async function recordRedemption(
  supabase: any,
  payload: {
    ticket_id: string | null
    quiniela_id: string | null
    user_id: string | null
    status: string
    message?: string | null
    user_agent?: string | null
  },
) {
  await supabase.from('quiniela_access_ticket_redemptions').insert({
    ticket_id: payload.ticket_id,
    quiniela_id: payload.quiniela_id,
    user_id: payload.user_id,
    status: payload.status,
    message: payload.message || null,
    user_agent: payload.user_agent || null,
  })
}

async function markTicketUsed(supabase: any, ticket: any) {
  await supabase
    .from('quiniela_access_tickets')
    .update({
      redeemed_count: Number(ticket.redeemed_count || 0) + 1,
      last_redeemed_at: new Date().toISOString(),
    })
    .eq('id', ticket.id)
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const user = await resolveUser(event, supabase)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const body = (await readBody(event).catch(() => ({}))) as RedeemTicketBody
  const ticketId = String(body.ticket_id || body.ticket || '').trim()

  if (!UUID_RE.test(ticketId)) {
    await recordRedemption(supabase, {
      ticket_id: null,
      quiniela_id: null,
      user_id: user.id,
      status: 'invalid',
      message: 'Formato de boleto invalido',
      user_agent: getHeader(event, 'user-agent') || null,
    })
    throw createError({ statusCode: 400, statusMessage: 'Boleto invalido' })
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('quiniela_access_tickets')
    .select('id, quiniela_id, label, status, expires_at, redeemed_count, last_redeemed_at')
    .eq('id', ticketId)
    .maybeSingle()

  if (ticketError) {
    throw createError({ statusCode: 500, statusMessage: ticketError.message })
  }

  if (!ticket) {
    await recordRedemption(supabase, {
      ticket_id: null,
      quiniela_id: null,
      user_id: user.id,
      status: 'invalid',
      message: 'Boleto no encontrado',
      user_agent: getHeader(event, 'user-agent') || null,
    })
    throw createError({ statusCode: 404, statusMessage: 'Boleto no encontrado' })
  }

  const { data: quiniela, error: quinielaError } = await supabase
    .from('quinielas')
    .select('id, name, description, has_test_data')
    .eq('id', ticket.quiniela_id)
    .maybeSingle()

  if (quinielaError) {
    throw createError({ statusCode: 500, statusMessage: quinielaError.message })
  }

  if (!quiniela) {
    await recordRedemption(supabase, {
      ticket_id: ticket.id,
      quiniela_id: ticket.quiniela_id,
      user_id: user.id,
      status: 'invalid',
      message: 'Quiniela no encontrada',
      user_agent: getHeader(event, 'user-agent') || null,
    })
    throw createError({ statusCode: 404, statusMessage: 'Quiniela no encontrada' })
  }

  const effectiveStatus = getTicketEffectiveStatus(ticket)

  if (effectiveStatus === 'revoked') {
    await recordRedemption(supabase, {
      ticket_id: ticket.id,
      quiniela_id: ticket.quiniela_id,
      user_id: user.id,
      status: 'revoked',
      message: 'Boleto expirado por admin',
      user_agent: getHeader(event, 'user-agent') || null,
    })
    throw createError({ statusCode: 410, statusMessage: 'Este boleto ya expiro' })
  }

  if (effectiveStatus === 'expired') {
    await recordRedemption(supabase, {
      ticket_id: ticket.id,
      quiniela_id: ticket.quiniela_id,
      user_id: user.id,
      status: 'expired',
      message: 'Boleto fuera de vigencia',
      user_agent: getHeader(event, 'user-agent') || null,
    })
    throw createError({ statusCode: 410, statusMessage: 'Este boleto ya expiro' })
  }

  if (Boolean(quiniela.has_test_data)) {
    await recordRedemption(supabase, {
      ticket_id: ticket.id,
      quiniela_id: ticket.quiniela_id,
      user_id: user.id,
      status: 'blocked',
      message: 'Quiniela en modo pruebas',
      user_agent: getHeader(event, 'user-agent') || null,
    })
    throw createError({
      statusCode: 403,
      statusMessage: 'Esta quiniela esta bloqueada por modo pruebas',
    })
  }

  const { error: memberError } = await supabase
    .from('quiniela_members')
    .insert({
      user_id: user.id,
      quiniela_id: ticket.quiniela_id,
    })

  if (memberError && memberError.code !== '23505') {
    throw createError({ statusCode: 500, statusMessage: memberError.message })
  }

  const status = memberError?.code === '23505' ? 'already_member' : 'redeemed'
  await markTicketUsed(supabase, ticket)
  await recordRedemption(supabase, {
    ticket_id: ticket.id,
    quiniela_id: ticket.quiniela_id,
    user_id: user.id,
    status,
    message: status === 'already_member' ? 'Usuario ya pertenecia a la quiniela' : 'Ingreso exitoso',
    user_agent: getHeader(event, 'user-agent') || null,
  })

  return {
    ok: true,
    status,
    quiniela: {
      id: quiniela.id,
      name: quiniela.name,
      description: quiniela.description,
    },
  }
})
