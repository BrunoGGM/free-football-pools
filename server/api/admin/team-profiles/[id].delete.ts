import { createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../../utils/adminAccess'

type DeleteTeamProfileBody = {
  force?: boolean
}

async function countRows(
  supabase: any,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return Number(count || 0)
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireGlobalAdminAccess(event, supabase)

  const profileId = getRouterParam(event, 'id')
  if (!profileId) {
    throw createError({ statusCode: 400, statusMessage: 'id requerido' })
  }

  const body = (await readBody(event).catch(() => ({}))) as DeleteTeamProfileBody
  const force = Boolean(body.force)

  const { data: existing, error: existingError } = await supabase
    .from('team_profiles')
    .select('id, name, team_key')
    .eq('id', profileId)
    .maybeSingle()

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Equipo no encontrado' })
  }

  const teamName = String(existing.name)

  const [matchesHomeCount, matchesAwayCount, quinielasChampionCount, membersChampionCount] =
    await Promise.all([
      countRows(supabase, 'matches', 'home_team', teamName),
      countRows(supabase, 'matches', 'away_team', teamName),
      countRows(supabase, 'quinielas', 'champion_team', teamName),
      countRows(supabase, 'quiniela_members', 'predicted_champion', teamName),
    ])

  const usage = {
    matchesHomeCount,
    matchesAwayCount,
    quinielasChampionCount,
    membersChampionCount,
    total:
      matchesHomeCount +
      matchesAwayCount +
      quinielasChampionCount +
      membersChampionCount,
  }

  if (usage.total > 0 && !force) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'No se puede eliminar: equipo en uso. Activa forzar eliminacion para limpiar referencias en quinielas.',
      data: {
        code: 'TEAM_IN_USE',
        usage,
      },
    })
  }

  let cleanedQuinielas = 0
  let cleanedMembers = 0

  if (force) {
    const { data: qRows, error: qError } = await supabase
      .from('quinielas')
      .update({ champion_team: null })
      .eq('champion_team', teamName)
      .select('id')

    if (qError) {
      throw createError({ statusCode: 500, statusMessage: qError.message })
    }

    cleanedQuinielas = Number(qRows?.length || 0)

    const { data: mRows, error: mError } = await supabase
      .from('quiniela_members')
      .update({
        predicted_champion: null,
        champion_predicted_at: null,
      })
      .eq('predicted_champion', teamName)
      .select('user_id')

    if (mError) {
      throw createError({ statusCode: 500, statusMessage: mError.message })
    }

    cleanedMembers = Number(mRows?.length || 0)

    // Deja los partidos historicos, pero limpia metadatos visuales asociados.
    await supabase
      .from('matches')
      .update({ home_team_code: null, home_team_logo_url: null })
      .eq('home_team', teamName)

    await supabase
      .from('matches')
      .update({ away_team_code: null, away_team_logo_url: null })
      .eq('away_team', teamName)
  }

  const { error: deleteError } = await supabase
    .from('team_profiles')
    .delete()
    .eq('id', profileId)

  if (deleteError) {
    throw createError({ statusCode: 500, statusMessage: deleteError.message })
  }

  return {
    ok: true,
    deletedId: profileId,
    deletedName: teamName,
    force,
    usage,
    cleanup: {
      quinielasChampionCleared: cleanedQuinielas,
      membersChampionCleared: cleanedMembers,
    },
  }
})
