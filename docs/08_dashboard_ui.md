# Module 08 — Autonomous Dashboard UI

> **Task for Claude Code:** Create `app/(authenticated)/autonomous/page.tsx`. This is the human-facing control panel for the autonomous scouting system. It allows users to trigger a run, monitor its status, and review qualifying draft leads — all without leaving the existing GROW Audit Tool interface.

---

## Design Principle

This page is a **self-contained React Server Component page** with two Client Component islands:
1. `<CampaignLauncher />` — form to configure and trigger a run
2. `<DraftLeadsList />` — live list of autonomous draft leads pending human review

The page reuses the existing design system (globals.css, CSS variables) already established in the GROW Audit Tool. Do not introduce new global styles.

---

## Page Layout Overview

```
┌──────────────────────────────────────────────────────────┐
│  🤖 Autonomous Lead Scouting                              │
│  Last run: 2 hours ago  |  14 qualified leads pending     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [ CampaignLauncher ]                                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Target Market: [__________________________]         │  │
│  │ Product:       [__________________________]         │  │
│  │ Min Subs: [1000]  Max Subs: [500000]               │  │
│  │ Queries:  [4]     Results:  [8]                    │  │
│  │                                                    │  │
│  │            [▶ Start Scouting Run]                  │  │
│  │                                                    │  │
│  │ ── Run Status ─────────────────────────────────── │  │
│  │ ✅ Discovered: 14  |  ✅ Qualified: 5  |  ❌ 9   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [ DraftLeadsList ]                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🎯 Awaiting Review (5)                              │  │
│  │ ┌──────────────────────────────────────────────┐   │  │
│  │ │ Channel Name     │ Subs │ Reason    │ Review  │   │  │
│  │ │ Tech With Tim    │ 45K  │ Tutorial… │ [→]     │   │  │
│  │ └──────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Files to Create

### File 1 of 2: The Page

**Path:** `c:\GROW\Audit-Tool\app\(authenticated)\autonomous\page.tsx`

```tsx
// app/(authenticated)/autonomous/page.tsx
// Autonomous Lead Scouting dashboard page.
// Server Component — fetches initial draft leads from Supabase at render time.

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { CampaignLauncher } from './components/CampaignLauncher'
import { DraftLeadsList } from './components/DraftLeadsList'

export const metadata: Metadata = {
  title: 'Autonomous Scouting | GROW Audit Tool',
  description: 'AI-powered autonomous YouTube channel discovery and lead qualification.',
}

// Fetch draft leads saved by the autonomous system (found_by = 'AUTO', draft = true)
async function getAutonomousDraftLeads() {
  const supabase = createServerComponentClient({ cookies })

  const { data, error } = await supabase
    .from('leads')
    .select(`
      id,
      channel_name,
      channel_url,
      youtube_channel_id,
      subscriber_count,
      total_views,
      country,
      remarks,
      created_at
    `)
    .eq('found_by', 'AUTO')
    .eq('draft', true)
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[autonomous/page] Failed to load draft leads:', error.message)
    return []
  }

  return data ?? []
}

export default async function AutonomousPage() {
  const draftLeads = await getAutonomousDraftLeads()

  return (
    <main className="autonomous-page">
      <header className="autonomous-page__header">
        <div className="autonomous-page__title-row">
          <span className="autonomous-page__icon" aria-hidden="true">🤖</span>
          <h1 className="autonomous-page__title">Autonomous Lead Scouting</h1>
        </div>
        <p className="autonomous-page__subtitle">
          Define a target market and let the system discover, enrich, and pre-qualify YouTube channels automatically.
          Qualified leads land here for your final review.
        </p>
      </header>

      <section className="autonomous-page__launcher" aria-label="Launch a scouting run">
        <CampaignLauncher />
      </section>

      <section className="autonomous-page__leads" aria-label="Draft leads awaiting review">
        <DraftLeadsList initialLeads={draftLeads} />
      </section>
    </main>
  )
}
```

---

### File 2 of 2: Client Components

**Path:** `c:\GROW\Audit-Tool\app\(authenticated)\autonomous\components\CampaignLauncher.tsx`

```tsx
// app/(authenticated)/autonomous/components/CampaignLauncher.tsx
// Client component: campaign config form + run trigger + status display.
'use client'

import { useState } from 'react'

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

export function CampaignLauncher() {
  const [targetMarket, setTargetMarket] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [minSubscribers, setMinSubscribers] = useState(1000)
  const [maxSubscribers, setMaxSubscribers] = useState(500000)
  const [queriesPerRun, setQueriesPerRun] = useState(4)
  const [resultsPerQuery, setResultsPerQuery] = useState(8)

  const [status, setStatus] = useState<RunStatus>('idle')
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleStartRun(e: React.FormEvent) {
    e.preventDefault()

    if (!targetMarket.trim() || !productDescription.trim()) {
      setErrorMessage('Target market and product description are required.')
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
          // The secret is read from a public env var — only used for additional
          // protection against accidental public triggers, not for user auth.
          'x-autonomous-secret': process.env.NEXT_PUBLIC_AUTONOMOUS_RUN_SECRET ?? '',
        },
        body: JSON.stringify({
          targetMarket: targetMarket.trim(),
          productDescription: productDescription.trim(),
          minSubscribers,
          maxSubscribers,
          queriesPerRun,
          resultsPerQuery,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`)
      }

      setSummary(data.summary)
      setStatus('success')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const isRunning = status === 'running'

  return (
    <div className="campaign-launcher">
      <h2 className="campaign-launcher__heading">Start a New Scouting Run</h2>

      <form className="campaign-launcher__form" onSubmit={handleStartRun} id="campaign-form">

        {/* Primary inputs */}
        <div className="campaign-launcher__field campaign-launcher__field--full">
          <label className="campaign-launcher__label" htmlFor="target-market">
            Target Market <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="target-market"
            className="campaign-launcher__textarea"
            placeholder='e.g. "Small tech tutorial channels covering productivity software, 10k–100k subscribers"'
            value={targetMarket}
            onChange={e => setTargetMarket(e.target.value)}
            rows={2}
            disabled={isRunning}
            required
          />
        </div>

        <div className="campaign-launcher__field campaign-launcher__field--full">
          <label className="campaign-launcher__label" htmlFor="product-description">
            Product Being Promoted <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="product-description"
            className="campaign-launcher__textarea"
            placeholder='e.g. "An AI video editing tool that auto-cuts silence and generates b-roll suggestions"'
            value={productDescription}
            onChange={e => setProductDescription(e.target.value)}
            rows={2}
            disabled={isRunning}
            required
          />
        </div>

        {/* Advanced settings */}
        <details className="campaign-launcher__advanced">
          <summary className="campaign-launcher__advanced-toggle">Advanced Settings</summary>

          <div className="campaign-launcher__grid">
            <div className="campaign-launcher__field">
              <label className="campaign-launcher__label" htmlFor="min-subs">Min Subscribers</label>
              <input
                id="min-subs"
                type="number"
                className="campaign-launcher__input"
                value={minSubscribers}
                min={0}
                onChange={e => setMinSubscribers(Number(e.target.value))}
                disabled={isRunning}
              />
            </div>

            <div className="campaign-launcher__field">
              <label className="campaign-launcher__label" htmlFor="max-subs">Max Subscribers</label>
              <input
                id="max-subs"
                type="number"
                className="campaign-launcher__input"
                value={maxSubscribers}
                min={0}
                onChange={e => setMaxSubscribers(Number(e.target.value))}
                disabled={isRunning}
              />
            </div>

            <div className="campaign-launcher__field">
              <label className="campaign-launcher__label" htmlFor="queries-per-run">
                Search Queries
                <span className="campaign-launcher__hint"> (100 YT units each)</span>
              </label>
              <input
                id="queries-per-run"
                type="number"
                className="campaign-launcher__input"
                value={queriesPerRun}
                min={1}
                max={10}
                onChange={e => setQueriesPerRun(Number(e.target.value))}
                disabled={isRunning}
              />
            </div>

            <div className="campaign-launcher__field">
              <label className="campaign-launcher__label" htmlFor="results-per-query">
                Results per Query
                <span className="campaign-launcher__hint"> (max 50)</span>
              </label>
              <input
                id="results-per-query"
                type="number"
                className="campaign-launcher__input"
                value={resultsPerQuery}
                min={1}
                max={50}
                onChange={e => setResultsPerQuery(Number(e.target.value))}
                disabled={isRunning}
              />
            </div>
          </div>

          <p className="campaign-launcher__quota-note">
            📊 Estimated YouTube API quota:{' '}
            <strong>{queriesPerRun * 100 + Math.ceil(queriesPerRun * resultsPerQuery / 50)} units</strong>
            {' '}of your 10,000/day free limit.
          </p>
        </details>

        {/* Submit */}
        <button
          id="start-scouting-btn"
          type="submit"
          className={`campaign-launcher__submit ${isRunning ? 'campaign-launcher__submit--running' : ''}`}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <span className="campaign-launcher__spinner" aria-hidden="true" />
              Scouting in Progress…
            </>
          ) : (
            <>▶ Start Scouting Run</>
          )}
        </button>
      </form>

      {/* Status / Results */}
      {isRunning && (
        <div className="campaign-launcher__status campaign-launcher__status--running" role="status" aria-live="polite">
          <div className="campaign-launcher__status-header">
            <span className="campaign-launcher__spinner-lg" aria-hidden="true" />
            <strong>Run in progress…</strong>
          </div>
          <p className="campaign-launcher__status-note">
            This may take 1–3 minutes depending on the number of channels to enrich.
            Do not close this tab.
          </p>
        </div>
      )}

      {status === 'success' && summary && (
        <div className="campaign-launcher__status campaign-launcher__status--success" role="status">
          <h3 className="campaign-launcher__status-header">✅ Run Complete</h3>
          <div className="campaign-launcher__summary-grid">
            <div className="campaign-launcher__stat">
              <span className="campaign-launcher__stat-value">{summary.totalDiscovered}</span>
              <span className="campaign-launcher__stat-label">Discovered</span>
            </div>
            <div className="campaign-launcher__stat">
              <span className="campaign-launcher__stat-value">{summary.totalEnriched}</span>
              <span className="campaign-launcher__stat-label">Enriched</span>
            </div>
            <div className="campaign-launcher__stat campaign-launcher__stat--qualified">
              <span className="campaign-launcher__stat-value">{summary.totalQualified}</span>
              <span className="campaign-launcher__stat-label">Qualified ↓</span>
            </div>
            <div className="campaign-launcher__stat campaign-launcher__stat--rejected">
              <span className="campaign-launcher__stat-value">{summary.totalRejected}</span>
              <span className="campaign-launcher__stat-label">Rejected</span>
            </div>
            <div className="campaign-launcher__stat">
              <span className="campaign-launcher__stat-value">
                {(summary.durationMs / 1000).toFixed(1)}s
              </span>
              <span className="campaign-launcher__stat-label">Duration</span>
            </div>
          </div>

          {summary.errors.length > 0 && (
            <details className="campaign-launcher__errors">
              <summary>{summary.errors.length} error(s) during run</summary>
              <ul>
                {summary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}

          <p className="campaign-launcher__refresh-note">
            ↓ Qualified leads have been added below. Refresh the page to see them.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="campaign-launcher__status campaign-launcher__status--error" role="alert">
          <strong>❌ Run Failed</strong>
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
```

**Path:** `c:\GROW\Audit-Tool\app\(authenticated)\autonomous\components\DraftLeadsList.tsx`

```tsx
// app/(authenticated)/autonomous/components/DraftLeadsList.tsx
// Client component: displays draft leads found by the autonomous system.
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface DraftLead {
  id: string
  channel_name: string
  channel_url: string
  youtube_channel_id: string
  subscriber_count: number
  total_views: number
  country: string | null
  remarks: string | null
  created_at: string
}

interface DraftLeadsListProps {
  initialLeads: DraftLead[]
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function extractQualificationReason(remarks: string | null): string {
  if (!remarks) return '—'
  // Remarks are stored as: "[AUTO-QUALIFIED] | <reason> | Category: ... | ..."
  // Extract just the reason (second segment)
  const parts = remarks.split(' | ')
  return parts[1] ?? remarks.slice(0, 120)
}

export function DraftLeadsList({ initialLeads }: DraftLeadsListProps) {
  const [leads] = useState<DraftLead[]>(initialLeads)

  if (leads.length === 0) {
    return (
      <div className="draft-leads">
        <h2 className="draft-leads__heading">
          🎯 Awaiting Your Review
          <span className="draft-leads__count">0</span>
        </h2>
        <div className="draft-leads__empty">
          <p>No autonomous draft leads yet.</p>
          <p>Start a scouting run above to discover and qualify YouTube channels automatically.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="draft-leads">
      <h2 className="draft-leads__heading">
        🎯 Awaiting Your Review
        <span className="draft-leads__count">{leads.length}</span>
      </h2>
      <p className="draft-leads__note">
        These channels were autonomously discovered and pre-qualified by AI.
        Click <strong>Review</strong> to inspect the full enrichment data, set the G-Factor, and save to Google Sheets.
      </p>

      <div className="draft-leads__table-wrapper" role="region" aria-label="Draft leads table">
        <table className="draft-leads__table">
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Subscribers</th>
              <th scope="col">Total Views</th>
              <th scope="col">Country</th>
              <th scope="col">AI Reason</th>
              <th scope="col">Found</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead.id} className="draft-leads__row">
                <td className="draft-leads__cell draft-leads__cell--name">
                  <a
                    href={lead.channel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="draft-leads__channel-link"
                    id={`channel-link-${lead.id}`}
                  >
                    {lead.channel_name}
                    <span className="draft-leads__external-icon" aria-hidden="true">↗</span>
                  </a>
                </td>
                <td className="draft-leads__cell">
                  {formatCount(lead.subscriber_count ?? 0)}
                </td>
                <td className="draft-leads__cell">
                  {formatCount(lead.total_views ?? 0)}
                </td>
                <td className="draft-leads__cell">
                  {lead.country ?? '—'}
                </td>
                <td className="draft-leads__cell draft-leads__cell--reason">
                  <span
                    className="draft-leads__reason"
                    title={lead.remarks ?? ''}
                  >
                    {extractQualificationReason(lead.remarks)}
                  </span>
                </td>
                <td className="draft-leads__cell draft-leads__cell--date">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
                <td className="draft-leads__cell draft-leads__cell--actions">
                  {/* Links to the existing lead review page — adjust path if different */}
                  <Link
                    href={`/leads/${lead.id}/review`}
                    className="draft-leads__review-btn"
                    id={`review-btn-${lead.id}`}
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

## CSS to Add

Append these styles to the project's existing `globals.css` or `app.css`. They use your existing CSS custom property tokens (e.g. `--color-bg`, `--color-surface`, `--color-accent`, `--color-text`). Adjust variable names to match your existing design system.

```css
/* ═══════════════════════════════════════════════════════════════
   AUTONOMOUS SCOUTING PAGE
   ══════════════════════════════════════════════════════════════ */

.autonomous-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.autonomous-page__header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.autonomous-page__title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.autonomous-page__icon {
  font-size: 1.75rem;
}

.autonomous-page__title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
}

.autonomous-page__subtitle {
  color: var(--color-text-muted, #888);
  max-width: 680px;
  line-height: 1.6;
  margin: 0;
}

/* ── Campaign Launcher ──────────────────────────────────────────── */

.campaign-launcher {
  background: var(--color-surface, #1a1a2e);
  border: 1px solid var(--color-border, rgba(255,255,255,0.08));
  border-radius: 1rem;
  padding: 1.75rem;
}

.campaign-launcher__heading {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1.25rem 0;
}

.campaign-launcher__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.campaign-launcher__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.campaign-launcher__label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted, #aaa);
}

.campaign-launcher__hint {
  font-size: 0.75rem;
  opacity: 0.6;
}

.campaign-launcher__textarea,
.campaign-launcher__input {
  background: var(--color-input-bg, rgba(255,255,255,0.05));
  border: 1px solid var(--color-border, rgba(255,255,255,0.1));
  border-radius: 0.5rem;
  padding: 0.6rem 0.85rem;
  color: var(--color-text, #fff);
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.campaign-launcher__textarea:focus,
.campaign-launcher__input:focus {
  outline: none;
  border-color: var(--color-accent, #6c63ff);
}

.campaign-launcher__textarea:disabled,
.campaign-launcher__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.campaign-launcher__advanced {
  border: 1px dashed var(--color-border, rgba(255,255,255,0.1));
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}

.campaign-launcher__advanced-toggle {
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text-muted, #aaa);
  user-select: none;
}

.campaign-launcher__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.campaign-launcher__quota-note {
  font-size: 0.8rem;
  color: var(--color-text-muted, #888);
  margin: 0.75rem 0 0 0;
}

.campaign-launcher__submit {
  align-self: flex-start;
  background: var(--color-accent, #6c63ff);
  color: #fff;
  border: none;
  border-radius: 0.6rem;
  padding: 0.75rem 1.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: opacity 0.2s, transform 0.1s;
}

.campaign-launcher__submit:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.campaign-launcher__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Spinner */
.campaign-launcher__spinner {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.campaign-launcher__spinner-lg {
  display: inline-block;
  width: 1.2rem;
  height: 1.2rem;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: var(--color-accent, #6c63ff);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Status panels */
.campaign-launcher__status {
  margin-top: 1.25rem;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid;
}

.campaign-launcher__status--running {
  background: rgba(108, 99, 255, 0.08);
  border-color: rgba(108, 99, 255, 0.3);
}

.campaign-launcher__status--success {
  background: rgba(34, 197, 94, 0.07);
  border-color: rgba(34, 197, 94, 0.3);
}

.campaign-launcher__status--error {
  background: rgba(239, 68, 68, 0.07);
  border-color: rgba(239, 68, 68, 0.3);
}

.campaign-launcher__status-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
}

.campaign-launcher__status-note {
  font-size: 0.85rem;
  color: var(--color-text-muted, #aaa);
  margin: 0;
}

.campaign-launcher__summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0.75rem 0;
}

.campaign-launcher__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.5rem 1rem;
  background: rgba(255,255,255,0.04);
  border-radius: 0.5rem;
  min-width: 80px;
}

.campaign-launcher__stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.campaign-launcher__stat-label {
  font-size: 0.72rem;
  color: var(--color-text-muted, #aaa);
  text-align: center;
}

.campaign-launcher__stat--qualified .campaign-launcher__stat-value {
  color: #22c55e;
}

.campaign-launcher__stat--rejected .campaign-launcher__stat-value {
  color: #ef4444;
}

.campaign-launcher__errors {
  font-size: 0.8rem;
  color: #f87171;
  margin-top: 0.5rem;
}

.campaign-launcher__refresh-note {
  font-size: 0.82rem;
  color: var(--color-text-muted, #aaa);
  margin: 0.5rem 0 0 0;
}

/* ── Draft Leads List ────────────────────────────────────────────── */

.draft-leads {
  background: var(--color-surface, #1a1a2e);
  border: 1px solid var(--color-border, rgba(255,255,255,0.08));
  border-radius: 1rem;
  padding: 1.75rem;
}

.draft-leads__heading {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.draft-leads__count {
  background: var(--color-accent, #6c63ff);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
}

.draft-leads__note {
  font-size: 0.85rem;
  color: var(--color-text-muted, #aaa);
  margin: 0 0 1.25rem 0;
  line-height: 1.5;
}

.draft-leads__empty {
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--color-text-muted, #888);
}

.draft-leads__table-wrapper {
  overflow-x: auto;
  border-radius: 0.5rem;
}

.draft-leads__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.draft-leads__table th {
  text-align: left;
  padding: 0.65rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted, #aaa);
  border-bottom: 1px solid var(--color-border, rgba(255,255,255,0.08));
}

.draft-leads__row {
  border-bottom: 1px solid var(--color-border, rgba(255,255,255,0.05));
  transition: background 0.15s;
}

.draft-leads__row:hover {
  background: rgba(255,255,255,0.03);
}

.draft-leads__cell {
  padding: 0.75rem 0.85rem;
  vertical-align: middle;
}

.draft-leads__cell--name {
  font-weight: 500;
}

.draft-leads__cell--reason {
  max-width: 280px;
}

.draft-leads__channel-link {
  color: var(--color-text, #fff);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.draft-leads__channel-link:hover {
  color: var(--color-accent, #6c63ff);
  text-decoration: underline;
}

.draft-leads__external-icon {
  font-size: 0.75rem;
  opacity: 0.5;
}

.draft-leads__reason {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--color-text-muted, #aaa);
  cursor: help;
}

.draft-leads__review-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.85rem;
  background: var(--color-accent, #6c63ff);
  color: #fff;
  border-radius: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.draft-leads__review-btn:hover {
  opacity: 0.85;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Important: Secret in Browser

The `CampaignLauncher` component sends the `x-autonomous-secret` header from the browser. For this to work, add this to `.env.local`:

```dotenv
NEXT_PUBLIC_AUTONOMOUS_RUN_SECRET=<same value as AUTONOMOUS_RUN_SECRET>
```

> **Security Note:** This means the secret is exposed in the browser bundle. This is acceptable because:
> - The page is behind authentication (the `(authenticated)` route group)
> - The secret is only a secondary guard — not the primary auth mechanism
> - If you prefer, move the trigger logic to a Server Action (see note below)

### Alternative: Server Action (More Secure)

Replace the `fetch('/api/autonomous/run')` call with a Server Action:

```tsx
// In page.tsx:
import { runAutonomousScouting } from '@/lib/autonomous/orchestrator'

async function triggerRun(formData: FormData) {
  'use server'
  const campaign = { /* extract from formData */ }
  const summary = await runAutonomousScouting(campaign)
  return summary
}
```

This eliminates the need for `NEXT_PUBLIC_AUTONOMOUS_RUN_SECRET` entirely. The tradeoff is that Server Actions have a 60-second timeout on Vercel (a run may take longer).

---

## Navigation: Add to Sidebar

In the existing sidebar or nav component (wherever `/dashboard`, `/leads`, etc. are listed), add:

```tsx
<Link href="/autonomous">🤖 Autonomous</Link>
```

---

## Completion Checklist

- [ ] `app/(authenticated)/autonomous/page.tsx` created
- [ ] `app/(authenticated)/autonomous/components/CampaignLauncher.tsx` created
- [ ] `app/(authenticated)/autonomous/components/DraftLeadsList.tsx` created
- [ ] CSS appended to existing `globals.css` — verify CSS variable names match your design system
- [ ] `NEXT_PUBLIC_AUTONOMOUS_RUN_SECRET` added to `.env.local`
- [ ] `npm run dev` — page loads at `http://localhost:3000/autonomous` without errors
- [ ] Submitting the form with valid inputs triggers the scouting run and displays the summary
- [ ] Draft leads table renders correctly for both empty and populated states
- [ ] "Review →" links navigate to the correct existing lead review page (update path if needed)
- [ ] Link to `/autonomous` added to existing navigation
