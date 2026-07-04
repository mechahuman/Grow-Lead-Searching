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
