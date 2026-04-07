import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../utils/adminAccess'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireGlobalAdminAccess(event, supabase)

  const [usersRes, globalAdminsRes, quinielasRes, membersRes, matchesRes, predictionsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_global_admin', true),
    supabase.from('quinielas').select('id', { count: 'exact', head: true }),
    supabase.from('quiniela_members').select('user_id', { count: 'exact', head: true }),
    supabase.from('matches').select('id', { count: 'exact', head: true }),
    supabase.from('predictions').select('id', { count: 'exact', head: true }),
  ])

  const results = [usersRes, globalAdminsRes, quinielasRes, membersRes, matchesRes, predictionsRes]
  const firstError = results.find((r) => r.error)?.error

  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message })
  }

  const { data: quinielas, error: quinielasError } = await supabase
    .from('quinielas')
    .select('id, name, description, access_code, start_date, end_date, champion_team, admin_id, ticket_price, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (quinielasError) {
    throw createError({ statusCode: 500, statusMessage: quinielasError.message })
  }

  const adminIds = Array.from(new Set((quinielas || []).map((q: any) => q.admin_id).filter(Boolean)))
  const adminMap = new Map<string, string>()

  if (adminIds.length > 0) {
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', adminIds)

    if (adminsError) {
      throw createError({ statusCode: 500, statusMessage: adminsError.message })
    }

    for (const admin of admins || []) {
      adminMap.set(admin.id as string, (admin.username as string) || 'N/A')
    }
  }

  return {
    ok: true,
    isGlobalAdmin: true,
    totals: {
      users: Number(usersRes.count || 0),
      globalAdmins: Number(globalAdminsRes.count || 0),
      quinielas: Number(quinielasRes.count || 0),
      members: Number(membersRes.count || 0),
      matches: Number(matchesRes.count || 0),
      predictions: Number(predictionsRes.count || 0),
    },
    quinielas: (quinielas || []).map((q: any) => ({
      id: q.id,
      name: q.name,
      description: q.description,
      access_code: q.access_code,
      start_date: q.start_date,
      end_date: q.end_date,
      champion_team: q.champion_team,
      admin_id: q.admin_id,
      ticket_price: Number(q.ticket_price || 0),
      admin_username: adminMap.get(q.admin_id as string) || 'N/A',
      created_at: q.created_at,
    })),
  }
})
