// lib/auth/context.tsx
// Auth context provider for managing user session

'use client'

import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { ReactNode, createContext, useContext, useEffect, useState } from 'react'

interface User {
  id: string
  email: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
          })
        }
      } catch (error) {
        console.error('[AuthProvider] Error getting session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getSession()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthProvider] Auth state changed:', event, session?.user?.email)
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
        })
      } else {
        setUser(null)
      }
      setIsLoading(false)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
      setUser(null)
    } catch (error) {
      console.error('[AuthProvider] Error signing out:', error)
    }
    // Clear cookie-based session (used by middleware)
    try {
      await fetch('/auth/signout', { method: 'POST', redirect: 'manual' })
    } catch {
      // ignore network errors — still redirect
    }
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
