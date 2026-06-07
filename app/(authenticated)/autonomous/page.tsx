// app/(authenticated)/autonomous/page.tsx
// Autonomous Lead Discovery Dashboard - Server Component
// Fetches initial discovered leads from the autonomous Supabase project

import type { Metadata } from 'next'
import { DiscoveryLauncher } from './components/DiscoveryLauncher'
import { DiscoveredLeadsList } from './components/DiscoveredLeadsList'

export const metadata: Metadata = {
  title: 'Autonomous Lead Discovery | GROW Audit Tool',
  description: 'AI-powered autonomous YouTube channel discovery and lead qualification.',
}

// Disable caching for this page to ensure fresh data on every reload
export const revalidate = 0

// Fetch discovered leads from the autonomous Supabase project
async function getDiscoveredLeads() {
  try {
    // Import the autonomous Supabase client
    const { getAutonomousSupabaseAdmin } = await import('@/lib/autonomous/supabase-client')
    const supabase = getAutonomousSupabaseAdmin()

    const { data, error } = await supabase
      .from('autonomous_leads')
      .select(`
        id,
        channel_name,
        channel_url,
        youtube_channel_id,
        subscriber_count,
        total_views,
        country,
        is_qualified,
        qualification_reason,
        category,
        content_style,
        monetization_likelihood,
        admin_status,
        reviewed_at,
        created_at
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
    <main className="animate-fade-in min-h-screen px-6 py-8 xl:px-8 max-w-7xl mx-auto">
      {/* Page header — Centered, premium spacing */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gradient-primary mb-2">Autonomous Lead Discovery</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          AI-powered YouTube channel discovery and qualification powered by Groq LLM
        </p>
      </div>

      {/* Two-column layout: Launcher (5 cols) + Leads Table (7 cols) on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Discovery Launcher (5 columns on desktop) */}
        <section className="lg:col-span-5" aria-label="Launch a discovery run">
          <DiscoveryLauncher />
        </section>

        {/* Right Panel: Discovered Leads (7 columns on desktop) */}
        <section className="lg:col-span-7" aria-label="Discovered leads awaiting review">
          <DiscoveredLeadsList initialLeads={discoveredLeads} />
        </section>
      </div>
    </main>
  )
}
