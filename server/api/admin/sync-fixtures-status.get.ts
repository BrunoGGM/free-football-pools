import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { formatUtcDate } from '../../utils/apiFootball'
import { requireAdminAccess } from '../../utils/adminAccess'

const PROVIDER = 'api-football'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const dailyBudget = Math.max(1, Number(config.apiFootballDailyBudget || 100))
  const supabase = serverSupabaseServiceRole<any>(event)
  await requireAdminAccess(event, supabase)

  const today = formatUtcDate(new Date())

  const { data: usageRow, error: usageReadError } = await supabase
    .from('api_provider_usage')
    .select('requests_used')
    .eq('provider', PROVIDER)
    .eq('usage_date', today)
    .maybeSingle()

  if (usageReadError) {
    throw createError({ statusCode: 500, statusMessage: usageReadError.message })
  }

  const { data: stateRow, error: stateReadError } = await supabase
    .from('api_provider_sync_state')
    .select('last_synced_at, last_status, last_error, last_response_count')
    .eq('provider', PROVIDER)
    .maybeSingle()

  if (stateReadError) {
    throw createError({ statusCode: 500, statusMessage: stateReadError.message })
  }

  return {
    ok: true,
    provider: PROVIDER,
    today,
    requestsUsedToday: Number(usageRow?.requests_used || 0),
    dailyBudget,
    remainingToday: Math.max(0, dailyBudget - Number(usageRow?.requests_used || 0)),
    state: {
      lastSyncedAt: stateRow?.last_synced_at || null,
      lastStatus: stateRow?.last_status || 'idle',
      lastError: stateRow?.last_error || null,
      lastResponseCount: Number(stateRow?.last_response_count || 0),
    },
  }
})
