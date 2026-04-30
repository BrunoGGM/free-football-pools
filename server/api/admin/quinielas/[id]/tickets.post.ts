import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'
import {
  normalizeTicketRecord,
  requireManagedQuiniela,
} from '../../../../utils/quinielaAccessTickets'

type CreateTicketBody = {
  label?: string | null
  expires_at?: string | null
}

const defaultExpiresAt = (quinielaEndDate: string | null) => {
  if (quinielaEndDate) {
    return quinielaEndDate
  }

  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toISOString()
}

const parseExpiresAt = (value: unknown, fallback: string | null) => {
  if (value === null) {
    return null
  }

  const raw = typeof value === 'string' ? value.trim() : ''
  const expiresAt = raw || fallback

  if (!expiresAt) {
    return null
  }

  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'expires_at invalido' })
  }

  if (date.getTime() <= Date.now()) {
    throw createError({ statusCode: 400, statusMessage: 'expires_at debe ser una fecha futura' })
  }

  return date.toISOString()
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user, isGlobalAdmin } = await requireAdminAccess(event, supabase)

  const quinielaId = getRouterParam(event, 'id')
  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  const quiniela = await requireManagedQuiniela(supabase, {
    quinielaId,
    userId: user.id,
    isGlobalAdmin,
  })

  const body = (await readBody(event).catch(() => ({}))) as CreateTicketBody
  const label = typeof body.label === 'string' ? body.label.trim() || null : null

  if (label && label.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'label excede 80 caracteres' })
  }

  const expiresAt = parseExpiresAt(body.expires_at, defaultExpiresAt(quiniela.end_date || null))

  const { data: ticket, error } = await supabase
    .from('quiniela_access_tickets')
    .insert({
      quiniela_id: quinielaId,
      label,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('id, quiniela_id, label, status, expires_at, redeemed_count, last_redeemed_at, created_by, revoked_by, revoked_at, created_at, updated_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    ok: true,
    ticket: normalizeTicketRecord(event, ticket),
  }
})
