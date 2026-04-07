interface QuinielaRow {
  id: string
  name: string
  description: string | null
  access_code: string
  start_date: string
  end_date: string | null
  admin_id: string
  champion_team: string | null
}

interface QuinielaMemberRow {
  quiniela_id: string
  total_points: number
  created_at: string
  quiniela: QuinielaRow | null
}

export function useActiveQuiniela() {
  const client = useSupabaseClient<any>()
  const user = useSupabaseUser()
  const activeQuinielaId = useCookie<string | null>('active_quiniela_id', {
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })

  const quiniela = useState<QuinielaRow | null>('active-quiniela', () => null)
  const myQuinielas = useState<QuinielaMemberRow[]>('my-quinielas', () => [])
  const loading = useState<boolean>('active-quiniela-loading', () => false)
  const errorMessage = useState<string | null>('active-quiniela-error', () => null)

  const setActiveQuiniela = (quinielaId: string | null) => {
    activeQuinielaId.value = quinielaId
  }

  const clearActiveQuiniela = () => {
    activeQuinielaId.value = null
    quiniela.value = null
    myQuinielas.value = []
  }

  const loadMyQuinielas = async () => {
    if (!user.value) {
      myQuinielas.value = []
      return [] as QuinielaMemberRow[]
    }

    const { data, error } = await client
      .from('quiniela_members')
      .select(
        'quiniela_id, total_points, created_at, quiniela:quinielas(id, name, description, access_code, start_date, end_date, admin_id, champion_team)',
      )
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })

    if (error) {
      errorMessage.value = error.message
      myQuinielas.value = []
      return [] as QuinielaMemberRow[]
    }

    const normalized = ((data as any[]) ?? [])
      .map((row) => ({
        quiniela_id: row.quiniela_id as string,
        total_points: Number(row.total_points ?? 0),
        created_at: row.created_at as string,
        quiniela: (row.quiniela as QuinielaRow | null) ?? null,
      }))
      .filter((row) => Boolean(row.quiniela))

    myQuinielas.value = normalized
    return normalized
  }

  const ensureActiveQuiniela = async () => {
    const memberships = await loadMyQuinielas()

    if (memberships.length === 0) {
      activeQuinielaId.value = null
      quiniela.value = null
      return null
    }

    const current = activeQuinielaId.value
      ? memberships.find((item) => item.quiniela_id === activeQuinielaId.value)
      : null

    const selected = current ?? memberships[0]

    activeQuinielaId.value = selected.quiniela_id
    quiniela.value = selected.quiniela
    return quiniela.value
  }

  const loadActiveQuiniela = async () => {
    if (!activeQuinielaId.value) {
      return await ensureActiveQuiniela()
    }

    loading.value = true
    errorMessage.value = null

    const { data, error } = await client
      .from('quinielas')
      .select('id, name, description, access_code, start_date, end_date, admin_id, champion_team')
      .eq('id', activeQuinielaId.value)
      .maybeSingle()

    loading.value = false

    if (error) {
      errorMessage.value = error.message
      quiniela.value = null

      return await ensureActiveQuiniela()
    }

    quiniela.value = (data as QuinielaRow | null) ?? null

    if (!quiniela.value) {
      return await ensureActiveQuiniela()
    }

    return quiniela.value
  }

  return {
    activeQuinielaId,
    quiniela,
    myQuinielas,
    loading,
    errorMessage,
    setActiveQuiniela,
    clearActiveQuiniela,
    loadMyQuinielas,
    ensureActiveQuiniela,
    loadActiveQuiniela,
  }
}
