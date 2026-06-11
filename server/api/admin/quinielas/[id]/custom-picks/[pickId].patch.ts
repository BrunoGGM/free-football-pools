import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminAccess } from '../../../../../utils/adminAccess'
import { requireManagedQuiniela } from '../../../../../utils/quinielaAccessTickets'

type CustomPickPatchBody = {
  title?: string
  description?: string | null
  requires_text?: boolean
  requires_country?: boolean
  points?: number | string
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

const parseLocksAt = (value: unknown) => {
  if (value === null || value === '') {
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
  const pickId = getRouterParam(event, 'pickId')

  if (!quinielaId) {
    throw createError({ statusCode: 400, statusMessage: 'id de quiniela requerido' })
  }

  if (!pickId) {
    throw createError({ statusCode: 400, statusMessage: 'id de pick requerido' })
  }

  await requireManagedQuiniela(supabase, {
    quinielaId,
    userId: user.id,
    isGlobalAdmin,
  })

  const body = (await readBody(event).catch(() => ({}))) as CustomPickPatchBody
  const payload: Record<string, unknown> = {}

  if (typeof body.title === 'string') {
    const title = body.title.trim()
    if (title.length < 3 || title.length > 160) {
      throw createError({ statusCode: 400, statusMessage: 'title debe tener entre 3 y 160 caracteres' })
    }
    payload.title = title
  }

  if (body.description !== undefined) {
    const description =
      typeof body.description === 'string' ? body.description.trim() || null : null
    if (description && description.length > 480) {
      throw createError({ statusCode: 400, statusMessage: 'description excede 480 caracteres' })
    }
    payload.description = description
  }

  const nextRequiresText =
    body.requires_text !== undefined ? Boolean(body.requires_text) : undefined
  const nextRequiresCountry =
    body.requires_country !== undefined ? Boolean(body.requires_country) : undefined

  if (nextRequiresText !== undefined) {
    payload.requires_text = nextRequiresText
  }

  if (nextRequiresCountry !== undefined) {
    payload.requires_country = nextRequiresCountry
  }

  if (body.points !== undefined) {
    payload.points = parsePoints(body.points)
  }

  if (body.locks_at !== undefined) {
    payload.locks_at = parseLocksAt(body.locks_at)
  }

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nada para actualizar' })
  }

  const { data: existing, error: existingError } = await supabase
    .from('quiniela_custom_picks')
    .select('requires_text, requires_country')
    .eq('id', pickId)
    .eq('quiniela_id', quinielaId)
    .maybeSingle()

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Pick no encontrado' })
  }

  const resolvedRequiresText =
    nextRequiresText ?? Boolean(existing.requires_text)
  const resolvedRequiresCountry =
    nextRequiresCountry ?? Boolean(existing.requires_country)

  if (!resolvedRequiresText && !resolvedRequiresCountry) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El pick debe requerir texto y/o seleccion de pais',
    })
  }

  const { data: pick, error: updateError } = await supabase
    .from('quiniela_custom_picks')
    .update(payload)
    .eq('id', pickId)
    .eq('quiniela_id', quinielaId)
    .select(
      'id, quiniela_id, title, description, requires_text, requires_country, points, locks_at, created_at, updated_at',
    )
    .single()

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }

  return { ok: true, pick }
})
