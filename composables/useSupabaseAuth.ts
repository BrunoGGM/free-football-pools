interface SignInPayload {
  email: string
  password: string
}

interface SignUpPayload {
  email: string
  password: string
  username: string
}

export function useSupabaseAuth() {
  const client = useSupabaseClient<any>()
  const user = useSupabaseUser()
  const loading = useState<boolean>('auth-loading', () => false)
  const errorMessage = useState<string | null>('auth-error', () => null)

  const resetError = () => {
    errorMessage.value = null
  }

  const signInWithPassword = async (payload: SignInPayload) => {
    loading.value = true
    errorMessage.value = null

    const { data, error } = await client.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    })

    if (error) {
      loading.value = false
      errorMessage.value = error.message
      return false
    }

    // Si por algun motivo falta el perfil, lo recreamos al iniciar sesion.
    const signedUser = data.user
    if (signedUser) {
      const metadataUsername =
        typeof signedUser.user_metadata?.username === 'string'
          ? signedUser.user_metadata.username.trim()
          : ''
      const fallbackUsername = `jugador_${signedUser.id.slice(0, 8)}`
      const preferredUsername =
        metadataUsername.length >= 3 && metadataUsername.length <= 32
          ? metadataUsername
          : fallbackUsername

      let { error: profileError } = await client
        .from('profiles')
        .upsert(
          {
            id: signedUser.id,
            username: preferredUsername,
          },
          { onConflict: 'id' },
        )

      if (profileError && preferredUsername !== fallbackUsername) {
        const retry = await client
          .from('profiles')
          .upsert(
            {
              id: signedUser.id,
              username: fallbackUsername,
            },
            { onConflict: 'id' },
          )
        profileError = retry.error
      }

      if (profileError) {
        loading.value = false
        errorMessage.value =
          'Sesion iniciada, pero no se pudo restaurar el perfil. Intenta de nuevo o contacta al admin.'
        return false
      }
    }

    loading.value = false

    return true
  }

  const signUpWithPassword = async (payload: SignUpPayload) => {
    loading.value = true
    errorMessage.value = null

    const { error } = await client.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          username: payload.username,
        },
      },
    })

    if (error) {
      loading.value = false
      errorMessage.value = error.message
      return false
    }

    loading.value = false
    return true
  }

  const signOut = async () => {
    loading.value = true
    errorMessage.value = null

    const { error } = await client.auth.signOut()

    loading.value = false

    if (error) {
      errorMessage.value = error.message
      return false
    }

    return true
  }

  return {
    user,
    loading,
    errorMessage,
    resetError,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  }
}
