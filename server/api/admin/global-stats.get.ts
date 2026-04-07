import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireGlobalAdminAccess } from '../../utils/adminAccess'
import { DEFAULT_QUINIELA_RULES } from '../../utils/quinielaRules'

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
  const quinielaIds = (quinielas || []).map((q: any) => q.id).filter(Boolean)
  const adminMap = new Map<string, string>()
  const ruleMap = new Map<string, typeof DEFAULT_QUINIELA_RULES>()

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

  if (quinielaIds.length > 0) {
    const { data: rules, error: rulesError } = await supabase
      .from('quiniela_rules')
      .select('quiniela_id, exact_score_points, correct_outcome_points, champion_bonus_points, exact_hit_min_points, streak_hit_min_points, streak_bonus_3_points, streak_bonus_5_points, allow_member_predictions_view')
      .in('quiniela_id', quinielaIds)

    if (rulesError && rulesError.code !== '42P01') {
      throw createError({ statusCode: 500, statusMessage: rulesError.message })
    }

    for (const item of rules || []) {
      const quinielaId = item.quiniela_id as string

      ruleMap.set(quinielaId, {
        exact_score_points: Number(item.exact_score_points ?? DEFAULT_QUINIELA_RULES.exact_score_points),
        correct_outcome_points: Number(item.correct_outcome_points ?? DEFAULT_QUINIELA_RULES.correct_outcome_points),
        champion_bonus_points: Number(item.champion_bonus_points ?? DEFAULT_QUINIELA_RULES.champion_bonus_points),
        exact_hit_min_points: Number(item.exact_hit_min_points ?? DEFAULT_QUINIELA_RULES.exact_hit_min_points),
        streak_hit_min_points: Number(item.streak_hit_min_points ?? DEFAULT_QUINIELA_RULES.streak_hit_min_points),
        streak_bonus_3_points: Number(item.streak_bonus_3_points ?? DEFAULT_QUINIELA_RULES.streak_bonus_3_points),
        streak_bonus_5_points: Number(item.streak_bonus_5_points ?? DEFAULT_QUINIELA_RULES.streak_bonus_5_points),
        allow_member_predictions_view: Boolean(
          item.allow_member_predictions_view ??
          DEFAULT_QUINIELA_RULES.allow_member_predictions_view,
        ),
      })
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
      rules: ruleMap.get(q.id as string) || DEFAULT_QUINIELA_RULES,
    })),
  }
})
