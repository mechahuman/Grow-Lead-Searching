// app/(authenticated)/autonomous/components/DiscoveredLeadsList.tsx
// Client component: table of discovered leads with qualification details
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DiscoveredLead {
  id: string
  channel_name: string | null
  channel_url: string | null
  youtube_channel_id: string
  subscriber_count: number | null
  total_views: number | null
  country: string | null
  is_qualified: boolean
  qualification_reason: string | null
  category: string | null
  content_style: string | null
  monetization_likelihood: string | null
  admin_status: string | null
  reviewed_at: string | null
  created_at: string
}

interface Props {
  initialLeads: DiscoveredLead[]
}

function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  } catch {
    return '—'
  }
}

export function DiscoveredLeadsList({ initialLeads }: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState<DiscoveredLead[]>(initialLeads)
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set())
  const [isReloading, setIsReloading] = useState(false)
  const [reloadHover, setReloadHover] = useState(false)
  const [deleteHover, setDeleteHover] = useState<string | null>(null)

  const handleReloadLeads = async () => {
    setIsReloading(true)
    try {
      // Full page reload to get fresh data
      window.location.reload()
    } finally {
      setIsReloading(false)
    }
  }

  const handleDeleteLead = async (leadId: string, channelName: string) => {
    if (!confirm(`Are you sure you want to delete "${channelName}" from the database?`)) {
      return
    }

    try {
      const response = await fetch('/api/autonomous/delete-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete lead')
      }

      // Remove from local state
      setLeads(leads.filter(l => l.id !== leadId))
    } catch (err) {
      alert('Error deleting lead: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const toggleReason = (leadId: string) => {
    const newSet = new Set(expandedReasons)
    if (newSet.has(leadId)) {
      newSet.delete(leadId)
    } else {
      newSet.add(leadId)
    }
    setExpandedReasons(newSet)
  }

  const cardStyle = {
    background: 'rgba(26, 26, 46, 0.65)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: '1.2rem',
    border: '1px solid rgba(42, 42, 78, 0.5)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: 0,
  }

  if (leads.length === 0) {
    return (
      <div style={cardStyle}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '-0.01em', flexShrink: 0 }}>
          Discovered Leads
          <span style={{ background: 'var(--gradient-primary)', color: '#fff', fontSize: '0.65rem', fontWeight: '700', padding: '0.2rem 0.55rem', borderRadius: '999px' }}>
            0
          </span>
        </h2>
        <div style={{ textAlign: 'center', padding: '2rem 1.5rem', color: 'var(--text-muted)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>No leads discovered yet.</p>
          <p style={{ margin: '0', fontSize: '0.8rem' }}>Start a run on the left to begin.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '1rem', flexShrink: 0 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0', display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '-0.01em' }}>
          Discovered Leads
          <span style={{ background: 'var(--gradient-primary)', color: '#fff', fontSize: '0.65rem', fontWeight: '700', padding: '0.2rem 0.55rem', borderRadius: '999px' }}>
            {leads.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={handleReloadLeads}
          disabled={isReloading}
          onMouseEnter={() => setReloadHover(true)}
          onMouseLeave={() => setReloadHover(false)}
          style={{
            background: reloadHover && !isReloading ? 'rgba(108, 99, 255, 0.25)' : 'rgba(108, 99, 255, 0.15)',
            color: '#b4a9f8',
            border: '1px solid rgba(108, 99, 255, 0.4)',
            borderRadius: '0.65rem',
            padding: '0.5rem 0.85rem',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: isReloading ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            opacity: isReloading ? '0.6' : '1',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: reloadHover && !isReloading ? '0 0 12px rgba(108, 99, 255, 0.15)' : 'none',
          }}
        >
          {isReloading ? (
            <>
              <span style={{
                display: 'inline-block',
                width: '0.6rem',
                height: '0.6rem',
                border: '1.5px solid rgba(180, 169, 248, 0.3)',
                borderTopColor: '#b4a9f8',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              Reloading…
            </>
          ) : (
            <>
              <span>↻</span>
              Reload
            </>
          )}
        </button>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: '1.5', flexShrink: 0 }}>
        All channels processed. <span style={{ color: '#86efac', fontWeight: '600' }}>✅ Qualified</span> are ready. <span style={{ color: '#fca5a5', fontWeight: '600' }}>❌ Rejected</span> did not meet criteria.
      </p>

      {/* Table — Premium styling with fixed height for scrolling */}
      <div style={{
        borderRadius: '0.85rem',
        border: '1px solid rgba(42, 42, 78, 0.4)',
        maxHeight: '360px',
        overflowY: 'auto',
        overflowX: 'auto',
      }} role="region" aria-label="Discovered leads table">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(42, 42, 78, 0.4)' }}>
              <th scope="col" style={{ textAlign: 'left', padding: '0.8rem 0.9rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Channel
              </th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.8rem 0.9rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Subs
              </th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.8rem 0.9rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Views
              </th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.8rem 0.9rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Loc
              </th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.8rem 0.9rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Cat
              </th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.8rem 0.9rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Status
              </th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.8rem 0.9rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Reason
              </th>
              <th scope="col" style={{ textAlign: 'left', padding: '0.8rem 0.9rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Found
              </th>
              <th scope="col" style={{ textAlign: 'center', padding: '0.8rem 0.9rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Del
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => {
              const isExpanded = expandedReasons.has(lead.id)
              const channelName = lead.channel_name || lead.youtube_channel_id
              const channelUrl = lead.channel_url || `https://www.youtube.com/channel/${lead.youtube_channel_id}`

              return (
              <tr key={lead.id}
                style={{
                  borderBottom: '1px solid rgba(42, 42, 78, 0.4)',
                  background: lead.is_qualified
                    ? 'transparent'
                    : 'rgba(239, 68, 68, 0.04)',
                  transition: 'all 0.2s ease',
                  cursor: lead.qualification_reason ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  const row = e.currentTarget as HTMLTableRowElement
                  row.style.background = lead.is_qualified
                    ? 'rgba(108, 99, 255, 0.08)'
                    : 'rgba(239, 68, 68, 0.08)'
                  row.style.boxShadow = 'inset 0 0 12px rgba(108, 99, 255, 0.06)'
                }}
                onMouseLeave={(e) => {
                  const row = e.currentTarget as HTMLTableRowElement
                  row.style.background = lead.is_qualified
                    ? 'transparent'
                    : 'rgba(239, 68, 68, 0.04)'
                  row.style.boxShadow = 'none'
                }}
                onClick={() => {
                  if (lead.qualification_reason) {
                    toggleReason(lead.id)
                  }
                }}
              >
                <td style={{ padding: '0.7rem 0.9rem', verticalAlign: 'middle', fontWeight: '500', fontSize: '0.85rem' }}>
                  <a
                    href={channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'color 0.2s ease',
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = '#b4a9f8'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)'
                    }}
                  >
                    {channelName}
                    <span style={{ fontSize: '0.7rem', opacity: '0.5', fontWeight: '400', flexShrink: 0 }}>↗</span>
                  </a>
                </td>
                <td style={{ padding: '0.7rem 0.9rem', verticalAlign: 'middle', fontSize: '0.85rem', fontWeight: '500' }}>
                  {formatCount(lead.subscriber_count)}
                </td>
                <td style={{ padding: '0.7rem 0.9rem', verticalAlign: 'middle', fontSize: '0.85rem', fontWeight: '500' }}>
                  {formatCount(lead.total_views)}
                </td>
                <td style={{ padding: '0.7rem 0.9rem', verticalAlign: 'middle', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {lead.country || '—'}
                </td>
                <td style={{ padding: '0.7rem 0.9rem', verticalAlign: 'middle' }}>
                  {lead.category ? (
                    <span style={{
                      display: 'inline-block',
                      background: 'rgba(108, 99, 255, 0.2)',
                      color: '#d4ceff',
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '999px',
                      textTransform: 'capitalize',
                      letterSpacing: '0.01em',
                      border: '1px solid rgba(108, 99, 255, 0.3)',
                      whiteSpace: 'nowrap',
                    }}>
                      {lead.category}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '0.7rem 0.9rem', verticalAlign: 'middle' }}>
                  <span style={{
                    display: 'inline-block',
                    background: lead.is_qualified ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: lead.is_qualified ? '#86efac' : '#fca5a5',
                    fontSize: '0.6rem',
                    fontWeight: '700',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    border: `1px solid ${lead.is_qualified ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {lead.is_qualified ? '✅ Q' : '❌ R'}
                  </span>
                </td>
                <td style={{ padding: '0.7rem 0.9rem', verticalAlign: 'middle', maxWidth: '250px' }}>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      cursor: lead.qualification_reason ? 'pointer' : 'default',
                      fontSize: '0.75rem',
                      lineHeight: '1.4',
                      transition: 'color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (lead.qualification_reason) {
                        (e.currentTarget as HTMLDivElement).style.color = 'var(--text-secondary)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.color = 'var(--text-muted)'
                    }}
                  >
                    {isExpanded ? (
                      <>
                        <strong style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{lead.is_qualified ? 'Selected:' : 'Rejected:'}</strong> {lead.qualification_reason || '(No reason provided)'}
                      </>
                    ) : (
                      <>
                        {lead.qualification_reason ? (
                          <span
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {lead.qualification_reason}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td style={{ padding: '0.7rem 0.9rem', verticalAlign: 'middle', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatDate(lead.created_at)}
                </td>
                <td style={{ padding: '0.7rem 0.9rem', verticalAlign: 'middle', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteLead(lead.id, lead.channel_name || 'Unknown')}
                    onMouseEnter={() => setDeleteHover(lead.id)}
                    onMouseLeave={() => setDeleteHover(null)}
                    style={{
                      background: deleteHover === lead.id ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.2)',
                      color: '#fca5a5',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '0.4rem',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                      boxShadow: deleteHover === lead.id ? '0 0 8px rgba(239, 68, 68, 0.2)' : 'none',
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            )
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
