// app/(authenticated)/components/Header.tsx
// Header component with user menu and sign-out

'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Header() {
  const { user, signOut, isLoading } = useAuth()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleSignOut = async () => {
    setIsMenuOpen(false)
    await signOut()
  }

  if (isLoading) {
    return (
      <header className="sticky top-0 z-40 backdrop-blur-sm border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="h-6 w-20 bg-border-subtle rounded animate-pulse"></div>
          <div className="h-10 w-10 bg-border-subtle rounded-full animate-pulse"></div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 backdrop-blur-sm border-b border-border-subtle bg-dark-bg/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo / Branding */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-pink to-accent-purple flex items-center justify-center">
            <span className="text-lg font-black text-white">G</span>
          </div>
          <h1 className="text-lg font-bold text-gradient-primary">GROW</h1>
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dark-bgAlt transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-pink to-accent-purple flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {user?.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-text-secondary hidden sm:inline">{user?.email}</span>
            <svg
              className={`w-4 h-4 text-text-secondary transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg card-glass shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle">
                <p className="text-xs text-text-muted">Signed in as</p>
                <p className="text-sm font-semibold text-text-primary truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 text-sm text-text-primary hover:bg-dark-bgAlt transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
