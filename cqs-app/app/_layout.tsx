import { useEffect, useRef } from 'react'
import { Stack } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import * as Linking from 'expo-linking'
import { SessionProvider, useSession } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function RootNavigator() {
  const { session, isLoading } = useSession()
  const handledInitialUrl = useRef(false)

  useEffect(() => {
    async function exchangeFromUrl(url: string | null) {
      if (!url || handledInitialUrl.current) return
      const { queryParams } = Linking.parse(url)
      const code = queryParams?.code
      if (typeof code === 'string') {
        handledInitialUrl.current = true
        await supabase.auth.exchangeCodeForSession(code)
      }
    }
    Linking.getInitialURL().then(exchangeFromUrl)
    const sub = Linking.addEventListener('url', e => exchangeFromUrl(e.url))
    return () => sub.remove()
  }, [])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  )
}
