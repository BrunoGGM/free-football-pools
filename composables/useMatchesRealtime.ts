export interface MatchItem {
  id: string
  api_fixture_id: number
  home_team: string
  away_team: string
  home_team_code: string | null
  away_team_code: string | null
  home_team_logo_url: string | null
  away_team_logo_url: string | null
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'in_progress' | 'finished'
  match_time: string
  source_time: string | null
  source_timezone: string | null
  venue: string | null
  stage: string
}

interface MatchesChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: MatchItem | null
  old: MatchItem | null
}

export function useMatchesRealtime(stageFilter: string[] = []) {
  const client = useSupabaseClient<any>()
  const matches = ref<MatchItem[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  const isDocumentVisible = ref(true)
  let channel: ReturnType<typeof client.channel> | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let needsRefreshOnVisible = false
  let visibilityListener: (() => void) | null = null

  const sortMatches = (items: MatchItem[]) => {
    return [...items].sort((a, b) => {
      return new Date(a.match_time).getTime() - new Date(b.match_time).getTime()
    })
  }

  const canIncludeStage = (stage: string) => {
    if (stageFilter.length === 0) {
      return true
    }

    return stageFilter.includes(stage)
  }

  const queueRefresh = (delay = 320) => {
    if (refreshTimer) {
      return
    }

    if (!isDocumentVisible.value) {
      needsRefreshOnVisible = true
      return
    }

    refreshTimer = setTimeout(() => {
      refreshTimer = null
      void fetchMatches()
    }, delay)
  }

  const upsertMatch = (incoming: MatchItem) => {
    if (!canIncludeStage(incoming.stage)) {
      matches.value = matches.value.filter((item) => item.id !== incoming.id)
      return
    }

    const next = [...matches.value]
    const existingIndex = next.findIndex((item) => item.id === incoming.id)

    if (existingIndex >= 0) {
      next[existingIndex] = {
        ...next[existingIndex],
        ...incoming,
      }
    } else {
      next.push(incoming)
    }

    matches.value = sortMatches(next)
  }

  const removeMatch = (id: string) => {
    matches.value = matches.value.filter((item) => item.id !== id)
  }

  const applyRealtimePayload = (payload: MatchesChangePayload) => {
    if (!payload) {
      queueRefresh()
      return
    }

    if (payload.eventType === 'DELETE') {
      const deletedId = payload.old?.id

      if (!deletedId) {
        queueRefresh()
        return
      }

      removeMatch(deletedId)
      return
    }

    const changedRow = payload.new

    if (!changedRow?.id) {
      queueRefresh()
      return
    }

    upsertMatch(changedRow)
  }

  const fetchMatches = async () => {
    loading.value = true
    errorMessage.value = null

    let query = client
      .from('matches')
      .select('id, api_fixture_id, home_team, away_team, home_team_code, away_team_code, home_team_logo_url, away_team_logo_url, home_score, away_score, status, match_time, source_time, source_timezone, venue, stage')
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

    matches.value = sortMatches((data as MatchItem[]) ?? [])
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
        (payload) => {
          if (!isDocumentVisible.value) {
            needsRefreshOnVisible = true
            return
          }

          applyRealtimePayload(payload as unknown as MatchesChangePayload)
        },
      )
      .subscribe()
  }

  onMounted(async () => {
    visibilityListener = () => {
      isDocumentVisible.value = !document.hidden

      if (isDocumentVisible.value && needsRefreshOnVisible) {
        needsRefreshOnVisible = false
        void fetchMatches()
      }
    }

    document.addEventListener('visibilitychange', visibilityListener)
    await fetchMatches()
    startRealtime()
  })

  onUnmounted(() => {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }

    if (visibilityListener) {
      document.removeEventListener('visibilitychange', visibilityListener)
    }

    void stopRealtime()
  })

  return {
    matches,
    loading,
    errorMessage,
    refresh: fetchMatches,
  }
}
