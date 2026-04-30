import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../utils/adminAccess'
import {
  DEFAULT_QUINIELA_RULES,
  parseQuinielaRulesInput,
} from '../../utils/quinielaRules'

type CreateQuinielaBody = {
  name?: string
  description?: string | null
  logo_url?: string | null
  access_code?: string
  start_date?: string
  end_date?: string | null
  admin_id?: string
  ticket_price?: number | string
  exact_score_points?: number | string
  correct_outcome_points?: number | string
  champion_bonus_points?: number | string
  exact_hit_min_points?: number | string
  streak_hit_min_points?: number | string
  streak_bonus_3_points?: number | string
  streak_bonus_5_points?: number | string
  allow_member_predictions_view?: boolean | string | number
}

const parseTicketPrice = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return 0
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createError({ statusCode: 400, statusMessage: 'ticket_price invalido (debe ser numero >= 0)' })
  }

  return Number(parsed.toFixed(2))
}

const parseLogoUrl = (value: unknown) => {
  if (value === undefined || value === null) {
    return null
  }

  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    return null
  }

  if (raw.length > 2048) {
    throw createError({ statusCode: 400, statusMessage: 'logo_url excede 2048 caracteres' })
  }

  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('invalid protocol')
    }
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'logo_url debe ser una URL http(s) valida' })
  }

  return raw
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  const { user } = await requireGlobalAdminAccess(event, supabase)
  const body = (await readBody(event).catch(() => ({}))) as CreateQuinielaBody

  const name = (body.name || '').trim()
  const accessCode = (body.access_code || '').trim().toUpperCase()
  const description = body.description?.trim() || null
  const logoUrl = parseLogoUrl(body.logo_url)
  const startDate = body.start_date || null
  const endDate = body.end_date || null
  const adminId = (body.admin_id || user.id).trim()
  const ticketPrice = parseTicketPrice(body.ticket_price)
  const { merged: rulesPayload } = parseQuinielaRulesInput(body, {
    base: DEFAULT_QUINIELA_RULES,
  })

  if (name.length < 3 || name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Nombre invalido (3 a 120 caracteres)' })
  }

  if (!/^[A-Z0-9]{6,12}$/.test(accessCode)) {
    throw createError({ statusCode: 400, statusMessage: 'Access code invalido (6 a 12 alfanumericos)' })
  }

  if (!startDate) {
    throw createError({ statusCode: 400, statusMessage: 'start_date es obligatorio' })
  }

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', adminId)
    .maybeSingle()

  if (adminProfileError) {
    throw createError({ statusCode: 500, statusMessage: adminProfileError.message })
  }

  if (!adminProfile) {
    throw createError({ statusCode: 400, statusMessage: 'admin_id no existe en profiles' })
  }

  const { data, error } = await supabase
    .from('quinielas')
    .insert({
      name,
      description,
      logo_url: logoUrl,
      access_code: accessCode,
      start_date: startDate,
      end_date: endDate,
      admin_id: adminId,
      ticket_price: ticketPrice,
    })
    .select('id, name, description, logo_url, access_code, admin_id, start_date, end_date, ticket_price')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const { error: rulesError } = await supabase
    .from('quiniela_rules')
    .upsert({
      quiniela_id: data.id,
      ...rulesPayload,
    }, { onConflict: 'quiniela_id' })

  if (rulesError) {
    if (rulesError.code === '42P01') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Reglas no disponibles aun. Aplica la migracion 0017.',
      })
    }

    throw createError({ statusCode: 500, statusMessage: rulesError.message })
  }

  await supabase.from('quiniela_members').upsert(
    {
      user_id: adminId,
      quiniela_id: data.id,
    },
    { onConflict: 'user_id,quiniela_id' },
  )

  return {
    ok: true,
    quiniela: {
      ...data,
      rules: rulesPayload,
    },
  }
})
