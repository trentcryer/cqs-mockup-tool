import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

interface SessionContextValue {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
}

const SessionContext = createContext<SessionContextValue>({ session: null, profile: null, isLoading: true })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
      setProfile(data as Profile | null)
    })
  }, [session?.user?.id])

  return <SessionContext.Provider value={{ session, profile, isLoading }}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}
