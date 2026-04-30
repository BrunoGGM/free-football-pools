interface QuinielaRow {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  access_code: string
  ticket_price: number
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
  const ticketPriceSupported = useState<boolean | null>('quiniela-ticket-price-supported', () => null)

  const isMissingOptionalQuinielaColumnError = (error: any) => {
    const message = String(error?.message || '').toLowerCase()

    return (
      error?.code === '42703' ||
      message.includes('ticket_price') ||
      message.includes('logo_url') ||
      (message.includes('column') && message.includes('quinielas'))
    )
  }

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

    const queryWithTicketPrice = () =>
      client
        .from('quiniela_members')
        .select(
          'quiniela_id, total_points, created_at, quiniela:quinielas(id, name, description, logo_url, access_code, ticket_price, start_date, end_date, admin_id, champion_team)',
        )
        .eq('user_id', user.value.id)
        .order('created_at', { ascending: false })

    const legacyQuery = () =>
      client
        .from('quiniela_members')
        .select(
          'quiniela_id, total_points, created_at, quiniela:quinielas(id, name, description, access_code, start_date, end_date, admin_id, champion_team)',
        )
        .eq('user_id', user.value.id)
        .order('created_at', { ascending: false })

    let result: any

    if (ticketPriceSupported.value === false) {
      result = await legacyQuery()
    } else {
      const scopedResult = await queryWithTicketPrice()

      if (scopedResult.error && isMissingOptionalQuinielaColumnError(scopedResult.error)) {
        ticketPriceSupported.value = false
        result = await legacyQuery()
      } else {
        ticketPriceSupported.value = true
        result = scopedResult
      }
    }

    const { data, error } = result

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
        quiniela: row.quiniela
          ? {
            ...(row.quiniela as QuinielaRow),
            logo_url: (row.quiniela as any).logo_url ?? null,
            ticket_price: Number((row.quiniela as any).ticket_price ?? 0),
          }
          : null,
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

    const queryWithTicketPrice = () =>
      client
        .from('quinielas')
        .select('id, name, description, logo_url, access_code, ticket_price, start_date, end_date, admin_id, champion_team')
        .eq('id', activeQuinielaId.value)
        .maybeSingle()

    const legacyQuery = () =>
      client
        .from('quinielas')
        .select('id, name, description, access_code, start_date, end_date, admin_id, champion_team')
        .eq('id', activeQuinielaId.value)
        .maybeSingle()

    let result: any

    if (ticketPriceSupported.value === false) {
      result = await legacyQuery()
    } else {
      const scopedResult = await queryWithTicketPrice()

      if (scopedResult.error && isMissingOptionalQuinielaColumnError(scopedResult.error)) {
        ticketPriceSupported.value = false
        result = await legacyQuery()
      } else {
        ticketPriceSupported.value = true
        result = scopedResult
      }
    }

    const { data, error } = result

    loading.value = false

    if (error) {
      errorMessage.value = error.message
      quiniela.value = null

      return await ensureActiveQuiniela()
    }

    quiniela.value = data
      ? {
        ...(data as QuinielaRow),
        logo_url: (data as any).logo_url ?? null,
        ticket_price: Number((data as any).ticket_price ?? 0),
      }
      : null

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
