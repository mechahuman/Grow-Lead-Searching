// app/(authenticated)/autonomous/components/DiscoveryLauncher.tsx
// Client component: form to configure and trigger a discovery run
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RunSummary {
  totalDiscovered: number
  totalSkippedDuplicate: number
  totalSkippedOutOfRange: number
  totalEnriched: number
  totalQualified: number
  totalRejected: number
  errors: string[]
  durationMs: number
}

type RunStatus = 'idle' | 'running' | 'success' | 'error'

export function DiscoveryLauncher() {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [maxQualifiedLeads, setMaxQualifiedLeads] = useState(5)

  const [status, setStatus] = useState<RunStatus>('idle')
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateHover, setGenerateHover] = useState(false)
  const [submitHover, setSubmitHover] = useState(false)
  const [submitActive, setSubmitActive] = useState(false)

  async function handleGenerateExample() {
    setIsGenerating(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/autonomous/generate-example', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? `Failed to generate example`)
      }

      setDescription(data.example)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleStartDiscovery(e: React.FormEvent) {
    e.preventDefault()

    if (!description.trim()) {
      setErrorMessage('Please describe what YouTube leads you are looking for.')
      return
    }

    setStatus('running')
    setSummary(null)
    setErrorMessage('')

    try {
      const response = await fetch('/api/autonomous/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-autonomous-secret': process.env.NEXT_PUBLIC_AUTONOMOUS_RUN_SECRET ?? '',
        },
        body: JSON.stringify({
          description: description.trim(),
          maxQualifiedLeads,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`)
      }

      setSummary(data.summary)
      setStatus('success')
      // Re-fetch server component data to show new leads without full page reload
      router.refresh()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const isRunning = status === 'running'

  return (
    <div style={{
      background: 'rgba(26, 26, 46, 0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: '1.2rem',
      border: '1px solid rgba(42, 42, 78, 0.5)',
      padding: '1.75rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', letterSpacing: '-0.01em' }}>Start a Discovery Run</h2>

      <form onSubmit={handleStartDiscovery} id="discovery-form">
        {/* Campaign Description */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="campaign-description" style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            What Kind of YouTube Channels Are You Looking For? <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            id="campaign-description"
            placeholder='E.g., fitness coaching channels, 5k-50k subs, English-speaking'
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            disabled={isRunning}
            required
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(108, 99, 255, 0.25)',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(108, 99, 255, 0.6)'
              e.currentTarget.style.backgroundColor = 'rgba(108, 99, 255, 0.08)'
              e.currentTarget.style.boxShadow = '0 0 12px rgba(108, 99, 255, 0.2), inset 0 1px 2px rgba(108, 99, 255, 0.05)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(108, 99, 255, 0.25)'
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.75rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0', lineHeight: '1.5', flex: 1 }}>
              Mention the niche, subscriber range, location, and content style. The AI will handle everything else.
            </p>
            <button
              type="button"
              onClick={handleGenerateExample}
              disabled={isGenerating || isRunning}
              onMouseEnter={() => setGenerateHover(true)}
              onMouseLeave={() => setGenerateHover(false)}
              style={{
                background: generateHover && !isGenerating && !isRunning ? 'rgba(108, 99, 255, 0.25)' : 'rgba(108, 99, 255, 0.15)',
                color: '#b4a9f8',
                border: '1px solid rgba(108, 99, 255, 0.4)',
                borderRadius: '0.65rem',
                padding: '0.5rem 1rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: isGenerating || isRunning ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                opacity: isGenerating || isRunning ? '0.6' : '1',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: generateHover && !isGenerating && !isRunning ? '0 0 12px rgba(108, 99, 255, 0.15)' : 'none',
              }}
            >
              {isGenerating ? (
                <>
                  <span style={{
                    display: 'inline-block',
                    width: '0.6rem',
                    height: '0.6rem',
                    border: '1.5px solid rgba(180, 169, 248, 0.3)',
                    borderTopColor: '#b4a9f8',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    marginRight: '0.4rem',
                  }} />
                  Generating…
                </>
              ) : (
                'Generate Example'
              )}
            </button>
          </div>
        </div>

        {/* Max Qualified Leads */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="max-leads" style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            How Many Qualified Leads Do You Want? <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input
              id="max-leads"
              type="number"
              value={maxQualifiedLeads}
              min={1}
              max={50}
              onChange={e => setMaxQualifiedLeads(Math.max(1, Math.min(50, Number(e.target.value))))}
              disabled={isRunning}
              required
              style={{
                width: '120px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(108, 99, 255, 0.25)',
                borderRadius: '0.75rem',
                padding: '0.75rem 1rem',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(108, 99, 255, 0.6)'
                e.currentTarget.style.backgroundColor = 'rgba(108, 99, 255, 0.08)'
                e.currentTarget.style.boxShadow = '0 0 10px rgba(108, 99, 255, 0.15)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(108, 99, 255, 0.25)'
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>leads (max 50)</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isRunning}
          onMouseEnter={() => !isRunning && setSubmitHover(true)}
          onMouseLeave={() => setSubmitHover(false)}
          onMouseDown={() => !isRunning && setSubmitActive(true)}
          onMouseUp={() => !isRunning && setSubmitActive(false)}
          style={{
            alignSelf: 'flex-start',
            background: 'var(--gradient-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.75rem',
            padding: '0.85rem 2rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            opacity: isRunning ? '0.7' : '1',
            transition: 'all 0.2s ease, transform 0.08s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: submitHover && !isRunning ? '0 8px 24px rgba(168, 85, 247, 0.35), 0 0 20px rgba(108, 99, 255, 0.2)' : '0 4px 16px rgba(168, 85, 247, 0.2)',
            transform: submitActive && !isRunning ? 'scale(0.98)' : submitHover && !isRunning ? 'translateY(-2px)' : 'translateY(0)',
          }}
        >
          {isRunning ? (
            <>
              <span style={{
                display: 'inline-block',
                width: '0.9rem',
                height: '0.9rem',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              Discovery in Progress…
            </>
          ) : (
            '▶ Start Discovery'
          )}
        </button>
      </form>

      {/* Status / Results */}
      {isRunning && (
        <div style={{
          marginTop: '1.75rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '0.85rem',
          background: 'rgba(108, 99, 255, 0.08)',
          border: '1px solid rgba(108, 99, 255, 0.3)',
          boxShadow: '0 4px 12px rgba(108, 99, 255, 0.08)',
        }} role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: '1.1rem', height: '1.1rem', border: '2px solid rgba(108, 99, 255, 0.3)', borderTopColor: '#6c63ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <strong>Discovery in progress…</strong>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0' }}>
            This may take 1–3 minutes. Do not close this tab.
          </p>
        </div>
      )}

      {status === 'success' && summary && (
        <div style={{
          marginTop: '1.75rem',
          padding: '1.5rem',
          borderRadius: '0.85rem',
          background: 'rgba(34, 197, 94, 0.07)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          boxShadow: '0 4px 12px rgba(34, 197, 94, 0.08)',
        }}>
          <h3 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem' }}>✅ Discovery Complete</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>{summary.totalDiscovered}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Discovered</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>{summary.totalEnriched}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Enriched</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', color: '#22c55e' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>{summary.totalQualified}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Qualified ↓</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', color: '#ef4444' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>{summary.totalRejected}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rejected</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>{(summary.durationMs / 1000).toFixed(1)}s</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Duration</span>
            </div>
          </div>

          {summary.errors.length > 0 && (
            <details style={{ fontSize: '0.8rem', color: '#f87171', marginBottom: '0.5rem' }}>
              <summary style={{ cursor: 'pointer' }}>{summary.errors.length} error(s) during run</summary>
              <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: '0' }}>
                {summary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}

          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0' }}>
            ↓ New leads are loading below automatically.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div style={{
          marginTop: '1.75rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '0.85rem',
          background: 'rgba(239, 68, 68, 0.07)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)',
        }} role="alert">
          <strong style={{ fontSize: '0.95rem' }}>❌ Discovery Failed</strong>
          <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{errorMessage}</p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
