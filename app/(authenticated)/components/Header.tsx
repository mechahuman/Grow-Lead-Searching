'use client'

import { useAuth } from '@/lib/auth/context'
import { useState } from 'react'
import Link from 'next/link'

export function Header() {
  const { user, signOut, isLoading } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleSignOut = async () => {
    setIsMenuOpen(false)
    await signOut()
  }

  if (isLoading) {
    return (
      <nav className="sticky top-0 z-50 card-glass border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
           <div className="h-6 w-20 bg-border-subtle rounded animate-pulse"></div>
           <div className="h-8 w-8 bg-border-subtle rounded-full animate-pulse"></div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="sticky top-0 z-50 card-glass border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo & Brand aligned with Audit-Tool */}
        <Link href="/autonomous" className="flex items-center gap-3 group">
          <img
            src="/logo-light.png"
            alt="GROW Logo"
            width={80}
            height={80}
            className="transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        {/* Right-side actions */}
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 hidden md:block" style={{ color: 'var(--text-secondary)' }}>
            {user?.email}
          </span>

          {/* User Menu / Sign Out */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dark-bgAlt transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-pink to-accent-purple flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
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
              <div className="absolute right-0 mt-2 w-48 rounded-lg card-glass shadow-lg overflow-hidden border border-border-subtle bg-dark-bg">
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
      </div>
    </nav>
  )
}
