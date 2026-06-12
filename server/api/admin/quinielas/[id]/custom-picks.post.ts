import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../utils/adminAccess'
import { requireManagedQuiniela } from '../../../../utils/quinielaAccessTickets'

type CustomPickBody = {
  title?: string
  description?: string | null
  requires_text?: boolean
  requires_country?: boolean
  points?: number | string
  sort_order?: number | string
  locks_at?: string | null
}

const parsePoints = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'points invalido (entero entre 0 y 100)',
    })
  }

  return parsed
}

const parseSortOrder = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) {
    throw createError({
      statusCode: 400,
      statusMessage: 'sort_order invalido (entero entre 0 y 9999)',
    })
  }

  return parsed
}

const parseLocksAt = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const date = new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'locks_at invalido' })
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

  await requireManagedQuiniela(supabase, {
    quinielaId,
    userId: user.id,
    isGlobalAdmin,
  })

  const body = (await readBody(event).catch(() => ({}))) as CustomPickBody

  const title = String(body.title || '').trim()
  if (title.length < 3 || title.length > 160) {
    throw createError({ statusCode: 400, statusMessage: 'title debe tener entre 3 y 160 caracteres' })
  }

  const description =
    typeof body.description === 'string' ? body.description.trim() || null : null
  if (description && description.length > 480) {
    throw createError({ statusCode: 400, statusMessage: 'description excede 480 caracteres' })
  }

  const requiresText = body.requires_text !== false
  const requiresCountry = Boolean(body.requires_country)

  if (!requiresText && !requiresCountry) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El pick debe requerir texto y/o seleccion de pais',
    })
  }

  const points = parsePoints(body.points ?? 3)
  const sortOrder = parseSortOrder(body.sort_order ?? 0)
  const locksAt = parseLocksAt(body.locks_at)

  const { data: pick, error: insertError } = await supabase
    .from('quiniela_custom_picks')
    .insert({
      quiniela_id: quinielaId,
      title,
      description,
      requires_text: requiresText,
      requires_country: requiresCountry,
      points,
      sort_order: sortOrder,
      locks_at: locksAt,
      created_by: user.id,
    })
    .select(
      'id, quiniela_id, title, description, requires_text, requires_country, points, sort_order, locks_at, created_at, updated_at',
    )
    .single()

  if (insertError) {
    throw createError({ statusCode: 500, statusMessage: insertError.message })
  }

  return { ok: true, pick }
})
