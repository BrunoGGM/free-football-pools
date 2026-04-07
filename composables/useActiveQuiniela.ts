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

export function useActiveQuiniela() {
  const client = useSupabaseClient<any>()
  const activeQuinielaId = useCookie<string | null>('active_quiniela_id', {
    sameSite: 'lax',
  })

  const quiniela = useState<QuinielaRow | null>('active-quiniela', () => null)
  const loading = useState<boolean>('active-quiniela-loading', () => false)
  const errorMessage = useState<string | null>('active-quiniela-error', () => null)

  const setActiveQuiniela = (quinielaId: string | null) => {
    activeQuinielaId.value = quinielaId
  }

  const clearActiveQuiniela = () => {
    activeQuinielaId.value = null
    quiniela.value = null
  }

  const loadActiveQuiniela = async () => {
    if (!activeQuinielaId.value) {
      quiniela.value = null
      return null
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
      return null
    }

    quiniela.value = (data as QuinielaRow | null) ?? null
    return quiniela.value
  }

  return {
    activeQuinielaId,
    quiniela,
    loading,
    errorMessage,
    setActiveQuiniela,
    clearActiveQuiniela,
    loadActiveQuiniela,
  }
}
