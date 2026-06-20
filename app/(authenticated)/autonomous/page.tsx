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
    <main className="h-screen w-full overflow-hidden bg-transparent flex flex-col px-8 py-6 xl:px-12">
      <div className="max-w-full w-full flex flex-col h-full gap-5">
        {/* Page header — Professional spacing */}
        <div className="flex-shrink-0">
          <h1 className="text-4xl font-bold text-gradient-primary mb-2" style={{ letterSpacing: '-0.02em' }}>Autonomous Lead Discovery</h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', maxWidth: '600px' }}>
            AI-powered YouTube channel discovery and qualification powered by Groq LLM
          </p>
        </div>

        {/* Two-column layout: Launcher (40%) + Leads Table (60%) on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch flex-1 min-h-0">
          {/* Left Panel: Discovery Launcher */}
          <section className="lg:col-span-2 flex flex-col min-h-0" aria-label="Launch a discovery run">
            <DiscoveryLauncher />
          </section>

          {/* Right Panel: Discovered Leads */}
          <section className="lg:col-span-3 flex flex-col min-h-0 overflow-hidden" aria-label="Discovered leads awaiting review">
            <DiscoveredLeadsList initialLeads={discoveredLeads} />
          </section>
        </div>
      </div>
    </main>
  )
}
