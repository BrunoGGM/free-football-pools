export interface MatchItem {
  id: string
  api_fixture_id: number
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'in_progress' | 'finished'
  match_time: string
  stage: string
}

export function useMatchesRealtime(stageFilter: string[] = []) {
  const client = useSupabaseClient<any>()
  const matches = ref<MatchItem[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  let channel: ReturnType<typeof client.channel> | null = null

  const fetchMatches = async () => {
    loading.value = true
    errorMessage.value = null

    let query = client
      .from('matches')
      .select('id, api_fixture_id, home_team, away_team, home_score, away_score, status, match_time, stage')
      .order('match_time', { ascending: true })

    if (stageFilter.length > 0) {
      query = query.in('stage', stageFilter)
    }

    const { data, error } = await query

    loading.value = false

    if (error) {
      errorMessage.value = error.message
      return
    }

    matches.value = (data as MatchItem[]) ?? []
  }

  const stopRealtime = async () => {
    if (channel) {
      await client.removeChannel(channel)
      channel = null
    }
  }

  const startRealtime = () => {
    if (process.server) {
      return
    }

    const key = stageFilter.length > 0 ? stageFilter.join('-') : 'all'

    channel = client
      .channel(`matches-live-${key}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          void fetchMatches()
        },
      )
      .subscribe()
  }

  onMounted(async () => {
    await fetchMatches()
    startRealtime()
  })

  onUnmounted(() => {
    void stopRealtime()
  })

  return {
    matches,
    loading,
    errorMessage,
    refresh: fetchMatches,
  }
}
