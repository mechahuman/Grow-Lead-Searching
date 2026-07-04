# Autonomous Page Layout Update Plan

This guide provides the exact code replacements needed to align the layout of the `Autonomous-Lead` `/autonomous` page with the `Audit-Tool` `/leads` page. The alignment includes identical centered max-width constraints, matching navigation bar height and glass effect, and identical page header typography.

## 1. Update the Authenticated Layout Wrapper
To match the `Audit-Tool` container that centers content and sets the background, we need to update the root layout.

**File to Edit:** `app/(authenticated)/layout.tsx`

```tsx
import { Header } from './components/Header'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-page min-h-screen">
      <Header />
      {/* Centralized page content wrapper matching the Audit-Tool's layout */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
```

## 2. Update the Header to Match `NavbarWrapper`
In `Audit-Tool`, the navbar uses a `card-glass` style, is `16px` (`h-16`) tall, and uses the `logo-light.png`. We will update the `Header` to mirror this structure while retaining your current authentication logic.

**File to Edit:** `app/(authenticated)/components/Header.tsx`

```tsx
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
```

## 3. Restructure the Page Content
We need to remove the rigid `h-screen`, `flex-col`, and the inner `<main>` tag from the autonomous page itself. It should instead use an `animate-fade-in` wrapper and follow the exact spacing and font sizes used in `/leads`. 

**File to Edit:** `app/(authenticated)/autonomous/page.tsx`

```tsx
import type { Metadata } from 'next'
import { DiscoveryLauncher } from './components/DiscoveryLauncher'
import { DiscoveredLeadsList } from './components/DiscoveredLeadsList'

export const metadata: Metadata = {
  title: 'Autonomous Lead Discovery | GROW Audit Tool',
  description: 'AI-powered autonomous YouTube channel discovery and lead qualification.',
}

export const revalidate = 0

async function getDiscoveredLeads() {
  try {
    const { getAutonomousSupabaseAdmin } = await import('@/lib/autonomous/supabase-client')
    const supabase = getAutonomousSupabaseAdmin()

    const { data, error } = await supabase
      .from('autonomous_leads')
      .select(`
        id, channel_name, channel_url, youtube_channel_id, subscriber_count, total_views,
        country, is_qualified, qualification_reason, category, content_style,
        monetization_likelihood, admin_status, reviewed_at, created_at
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[autonomous/page] Failed to load discovered leads:', error.message)
      return []
    }

    return data ?? []
  } catch (err) {
    console.error('[autonomous/page] Error loading discovered leads:', err)
    return []
  }
}

export default async function AutonomousPage() {
  const discoveredLeads = await getDiscoveredLeads()

  return (
    <div className="animate-fade-in">
      {/* Page header mimicking the "Saved Leads" header style from Audit-Tool */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gradient-primary mb-1">Autonomous Lead Discovery</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            AI-powered YouTube channel discovery and qualification powered by Groq LLM
          </p>
        </div>
      </div>

      {/* Grid aligned to flow naturally rather than stretching to screen height */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Left Panel: Discovery Launcher */}
        <section className="lg:col-span-2" aria-label="Launch a discovery run">
          <DiscoveryLauncher />
        </section>

        {/* Right Panel: Discovered Leads */}
        <section className="lg:col-span-3 overflow-hidden" aria-label="Discovered leads awaiting review">
          <DiscoveredLeadsList initialLeads={discoveredLeads} />
        </section>
      </div>
    </div>
  )
}
```

---
*Note: If there are any missing icons or CSS classes from your global styles for `.card-glass` or `.bg-page` that haven't been copied over to this project yet, let me know and I can adapt the CSS!*
