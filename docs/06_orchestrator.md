# Module 06 — Orchestrator (Main Run Loop)

> **Task for Claude Code:** Create `lib/autonomous/orchestrator.ts`. This is the central coordinator that imports all other autonomous modules and wires them into a single end-to-end scouting run. It is the only file in `lib/autonomous/` that has cross-module dependencies.

---

## Design Principle: This Module is the Integration Point

All other modules (`query-generator.ts`, `search.ts`, `qualifier.ts`, `memory.ts`) are self-contained. The orchestrator is the **only file that ties them together**. It also reaches into the existing codebase to reuse the enrichment pipeline and the Supabase client.

**Import map:**
```
lib/autonomous/orchestrator.ts
  ├── ./query-generator   → generateSearchQueries()
  ├── ./search            → executeYouTubeSearch(), filterBySubscriberRange()
  ├── ./qualifier         → qualifyChannel(), ChannelSnapshot
  ├── ./memory            → logDecision(), hasChannelBeenProcessed()
  ├── ./types             → CampaignConfig, RunSummary, ScoutingDecision
  ├── ../youtube/orchestrator  → fetchAllYouTubeData()  [EXISTING — DO NOT MODIFY]
  ├── ../youtube/types    → YouTubeEnrichmentResult     [EXISTING — DO NOT MODIFY]
  └── @supabase/supabase-js    → createClient()
```

---

## How Enrichment Data Maps to the Qualifier's ChannelSnapshot

The existing `YouTubeEnrichmentResult` type (from `lib/youtube/types.ts`) is rich but structured for the manual audit tool. The orchestrator converts it to the leaner `ChannelSnapshot` type that the qualifier expects:

```
YouTubeEnrichmentResult              →   ChannelSnapshot
─────────────────────────────────────────────────────────
enrichment.channelId                 →   channelId
enrichment.channelTitle              →   channelTitle
enrichment.description               →   description
enrichment.subscriberCount           →   subscriberCount
enrichment.totalViews                →   totalViews
enrichment.videoCount                →   videoCount
enrichment.country                   →   country
enrichment.recentVideos[0].uploadDate →  lastUploadDate
enrichment.recentVideos[].title      →   recentVideoTitles[]
enrichment.recentVideos[].viewCount  →   recentVideoViews[]
enrichment.recentVideos[].likeCount  →   recentVideoLikes[]
enrichment.recentVideos[].commentCount → recentVideoComments[]
```

> **Note:** If `YouTubeEnrichmentResult` uses different field names in your codebase, adjust the `mapEnrichmentToSnapshot()` function accordingly. Do NOT modify `lib/youtube/types.ts` — adapt the mapping function here.

---

## File to Create

**Path:** `c:\GROW\Audit-Tool\lib\autonomous\orchestrator.ts`

```typescript
// lib/autonomous/orchestrator.ts
// Main run loop for the Autonomous Lead Scouting system.
//
// This is the ONLY file in lib/autonomous/ that imports from multiple modules.
// It orchestrates the full pipeline:
//   1. Generate search queries (LLM)
//   2. Execute YouTube searches
//   3. Pre-filter by subscriber count
//   4. Deduplicate against Supabase + OmniHub
//   5. Enrich each new channel (existing pipeline)
//   6. Qualify each channel (LLM)
//   7. Save qualified channels as draft leads
//   8. Log all decisions to OmniHub memory

import { createClient } from '@supabase/supabase-js'

// ── Autonomous modules (this file orchestrates all of them) ──────────────────
import { generateSearchQueries } from './query-generator'
import { executeYouTubeSearch, filterBySubscriberRange } from './search'
import { qualifyChannel } from './qualifier'
import type { ChannelSnapshot } from './qualifier'
import { logDecision, hasChannelBeenProcessed } from './memory'
import type { CampaignConfig, RunSummary } from './types'

// ── Existing pipeline (reused, not modified) ─────────────────────────────────
import { fetchAllYouTubeData } from '../youtube/orchestrator'
import type { YouTubeEnrichmentResult } from '../youtube/types'

// ─── Supabase Setup ──────────────────────────────────────────────────────────

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('[Orchestrator] NEXT_PUBLIC_SUPABASE_URL is not set.')
  if (!key) throw new Error('[Orchestrator] SUPABASE_SERVICE_ROLE_KEY is not set.')
  return createClient(url, key)
}

// ─── Helper: Map Enrichment → Snapshot ───────────────────────────────────────

/**
 * Converts the full YouTubeEnrichmentResult (from the existing pipeline)
 * into the leaner ChannelSnapshot that the qualifier expects.
 *
 * Adjust field names here if your YouTubeEnrichmentResult uses different property names.
 * Do NOT modify lib/youtube/types.ts.
 */
function mapEnrichmentToSnapshot(enrichment: YouTubeEnrichmentResult): ChannelSnapshot {
  const recentVideos = enrichment.recentVideos ?? []

  return {
    channelId: enrichment.channelId,
    channelTitle: enrichment.channelTitle,
    description: enrichment.description ?? '',
    subscriberCount: enrichment.subscriberCount ?? 0,
    totalViews: enrichment.totalViews ?? 0,
    videoCount: enrichment.videoCount ?? 0,
    country: enrichment.country,
    lastUploadDate: recentVideos[0]?.uploadDate,
    recentVideoTitles: recentVideos.map(v => v.title ?? '').filter(Boolean).slice(0, 5),
    recentVideoViews: recentVideos.map(v => v.viewCount ?? 0).slice(0, 5),
    recentVideoLikes: recentVideos.map(v => v.likeCount ?? 0).slice(0, 5),
    recentVideoComments: recentVideos.map(v => v.commentCount ?? 0).slice(0, 5),
  }
}

// ─── Helper: Supabase Deduplication ──────────────────────────────────────────

async function isChannelInSupabase(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  channelId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('leads')
    .select('id')
    .eq('youtube_channel_id', channelId)
    .maybeSingle()

  if (error) {
    console.warn(`[Orchestrator] ⚠️  Supabase dedup check failed for ${channelId}:`, error.message)
    return false // Fail open — if we can't check, proceed with enrichment
  }

  return !!data
}

// ─── Helper: Save Qualified Lead ─────────────────────────────────────────────

/**
 * Saves a qualified channel as a draft lead in Supabase.
 *
 * Uses the existing `leads` table — NO schema changes required.
 * Key fields:
 *   - found_by: 'AUTO'       → marks this as an autonomous discovery
 *   - draft: true            → requires human review before going to Google Sheets
 *   - status: 'new'          → initial state in the review workflow
 *
 * The qualification reason is stored in `remarks` (existing field).
 * Category/content style are stored in JSON in a `meta` field if it exists,
 * or appended to remarks if not.
 */
async function saveQualifiedLead(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  enrichment: YouTubeEnrichmentResult,
  qualification: Awaited<ReturnType<typeof qualifyChannel>>,
  campaign: CampaignConfig
): Promise<void> {
  // Build the qualification meta string to append to remarks
  const metaParts = [
    `[AUTO-QUALIFIED]`,
    qualification.reason,
    qualification.category ? `Category: ${qualification.category}` : null,
    qualification.contentStyle ? `Style: ${qualification.contentStyle}` : null,
    `Campaign: ${campaign.targetMarket}`,
  ].filter(Boolean).join(' | ')

  const leadPayload = {
    // ── Core channel identity ────────────────────────────────────────────────
    youtube_channel_id: enrichment.channelId,
    channel_name: enrichment.channelTitle,
    channel_url: `https://www.youtube.com/channel/${enrichment.channelId}`,

    // ── Channel stats ────────────────────────────────────────────────────────
    subscriber_count: enrichment.subscriberCount ?? 0,
    total_views: enrichment.totalViews ?? 0,
    video_count: enrichment.videoCount ?? 0,
    country: enrichment.country ?? null,
    description: (enrichment.description ?? '').slice(0, 2000),

    // ── Autonomous system markers ────────────────────────────────────────────
    found_by: 'AUTO',
    draft: true,
    status: 'new',

    // ── Qualification context (stored in remarks) ────────────────────────────
    remarks: metaParts,
  }

  const { error } = await supabase.from('leads').insert(leadPayload)

  if (error) {
    throw new Error(`[Orchestrator] Supabase insert failed for ${enrichment.channelTitle}: ${error.message}`)
  }

  console.log(`[Orchestrator] 💾 Saved to Supabase (draft=true): ${enrichment.channelTitle}`)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Runs the full autonomous scouting pipeline for a given campaign.
 *
 * This function is called by the API route (Module 07).
 * It is designed to run as a long-running async function — the API route
 * should trigger it without awaiting (fire-and-forget for the response),
 * or await it fully if running in a background job context.
 *
 * @param campaign - Campaign configuration (target market, product, subscriber range, etc.)
 * @returns RunSummary - statistics of what was discovered, qualified, rejected, etc.
 */
export async function runAutonomousScouting(campaign: CampaignConfig): Promise<RunSummary> {
  const startTime = Date.now()
  const supabase = getSupabaseAdminClient()

  // Initialise the run summary
  const summary: RunSummary = {
    totalDiscovered: 0,
    totalSkippedDuplicate: 0,
    totalSkippedOutOfRange: 0,
    totalEnriched: 0,
    totalQualified: 0,
    totalRejected: 0,
    errors: [],
    durationMs: 0,
  }

  // Read config from campaign object, with env var fallbacks
  const minSubs = campaign.minSubscribers ?? parseInt(process.env.AUTONOMOUS_MIN_SUBSCRIBERS ?? '1000', 10)
  const maxSubs = campaign.maxSubscribers ?? parseInt(process.env.AUTONOMOUS_MAX_SUBSCRIBERS ?? '500000', 10)
  const queriesPerRun = campaign.queriesPerRun ?? parseInt(process.env.AUTONOMOUS_QUERIES_PER_RUN ?? '4', 10)
  const resultsPerQuery = campaign.resultsPerQuery ?? parseInt(process.env.AUTONOMOUS_RESULTS_PER_QUERY ?? '8', 10)

  console.log('\n══════════════════════════════════════════════')
  console.log('[Orchestrator] 🚀 Autonomous Scouting Run Started')
  console.log(`[Orchestrator] Target Market: "${campaign.targetMarket}"`)
  console.log(`[Orchestrator] Product: "${campaign.productDescription}"`)
  console.log(`[Orchestrator] Subscriber Range: ${minSubs.toLocaleString()} – ${maxSubs.toLocaleString()}`)
  console.log('══════════════════════════════════════════════\n')

  // ── Step 1: Generate search queries via LLM ──────────────────────────────
  console.log('[Orchestrator] Step 1/5: Generating search queries...')
  let queries: string[]

  try {
    const generated = await generateSearchQueries({
      targetMarket: campaign.targetMarket,
      productDescription: campaign.productDescription,
      count: queriesPerRun,
    })
    queries = generated.queries
    console.log(`[Orchestrator] ✅ Generated ${queries.length} queries.`)
  } catch (err) {
    const msg = `Query generation failed: ${String(err)}`
    console.error(`[Orchestrator] ❌ ${msg}`)
    summary.errors.push(msg)
    summary.durationMs = Date.now() - startTime
    return summary
  }

  // ── Step 2: Execute YouTube searches ────────────────────────────────────
  console.log('\n[Orchestrator] Step 2/5: Executing YouTube searches...')
  const discovered = await executeYouTubeSearch(queries, resultsPerQuery)
  summary.totalDiscovered = discovered.length
  console.log(`[Orchestrator] ✅ Discovered ${discovered.length} unique channels.`)

  if (discovered.length === 0) {
    console.log('[Orchestrator] No channels discovered. Ending run early.')
    summary.durationMs = Date.now() - startTime
    return summary
  }

  // ── Step 3: Pre-filter by subscriber range ───────────────────────────────
  console.log('\n[Orchestrator] Step 3/5: Filtering by subscriber range...')
  const inRange = await filterBySubscriberRange(discovered, minSubs, maxSubs)
  summary.totalSkippedOutOfRange = discovered.length - inRange.length
  console.log(`[Orchestrator] ✅ ${inRange.length} channels within range. ${summary.totalSkippedOutOfRange} filtered out.`)

  if (inRange.length === 0) {
    console.log('[Orchestrator] No channels in range. Ending run early.')
    summary.durationMs = Date.now() - startTime
    return summary
  }

  // ── Step 4: Process each channel (dedup → enrich → qualify → save) ──────
  console.log(`\n[Orchestrator] Steps 4-5/5: Processing ${inRange.length} channels...\n`)

  for (const channel of inRange) {
    console.log(`─────────────────────────────────────────`)
    console.log(`[Orchestrator] Processing: "${channel.channelTitle}" (${channel.channelId})`)

    // ── Gate 1: Supabase exact deduplication ────────────────────────────
    const inDB = await isChannelInSupabase(supabase, channel.channelId)
    if (inDB) {
      console.log(`[Orchestrator] ⏭️  Already in Supabase DB. Skipping.`)
      summary.totalSkippedDuplicate++

      // Log to OmniHub so future runs also skip it fast
      logDecision({
        channelId: channel.channelId,
        channelTitle: channel.channelTitle,
        reason: 'Already exists in Supabase database',
        category: 'duplicate_channel',
      })
      continue
    }

    // ── Gate 2: OmniHub exact channel ID check ───────────────────────────
    if (hasChannelBeenProcessed(channel.channelId)) {
      console.log(`[Orchestrator] ⏭️  Already processed in OmniHub memory. Skipping.`)
      summary.totalSkippedDuplicate++
      continue
    }

    // ── Step 4a: Enrich channel via existing pipeline ────────────────────
    let enrichment: YouTubeEnrichmentResult
    try {
      const channelUrl = `https://www.youtube.com/channel/${channel.channelId}`
      console.log(`[Orchestrator] Enriching: ${channelUrl}`)
      enrichment = await fetchAllYouTubeData(channelUrl)
      summary.totalEnriched++
      console.log(`[Orchestrator] ✅ Enrichment complete.`)
    } catch (err) {
      const msg = `Enrichment failed for ${channel.channelId}: ${String(err)}`
      console.error(`[Orchestrator] ❌ ${msg}`)
      summary.errors.push(msg)
      continue // Skip to next channel
    }

    // ── Step 4b: Convert enrichment → snapshot for qualifier ─────────────
    const snapshot = mapEnrichmentToSnapshot(enrichment)

    // ── Step 4c: LLM qualification ───────────────────────────────────────
    let qualification: Awaited<ReturnType<typeof qualifyChannel>>
    try {
      qualification = await qualifyChannel(snapshot, campaign)
    } catch (err) {
      const msg = `Qualification error for ${channel.channelId}: ${String(err)}`
      console.error(`[Orchestrator] ❌ ${msg}`)
      summary.errors.push(msg)
      continue // Skip to next channel
    }

    // ── Step 4d: Save or reject ──────────────────────────────────────────
    if (qualification.qualified) {
      try {
        await saveQualifiedLead(supabase, enrichment, qualification, campaign)
        summary.totalQualified++

        logDecision({
          channelId: channel.channelId,
          channelTitle: channel.channelTitle,
          reason: qualification.reason,
          category: 'qualified_lead',
        })
      } catch (err) {
        const msg = `Save failed for ${channel.channelId}: ${String(err)}`
        console.error(`[Orchestrator] ❌ ${msg}`)
        summary.errors.push(msg)
      }
    } else {
      summary.totalRejected++

      logDecision({
        channelId: channel.channelId,
        channelTitle: channel.channelTitle,
        reason: qualification.reason,
        category: 'rejected_lead',
      })
    }

    // ── Throttle between channels to avoid rate limiting ─────────────────
    await new Promise(r => setTimeout(r, 500))
  }

  // ── Final summary ────────────────────────────────────────────────────────
  summary.durationMs = Date.now() - startTime

  console.log('\n══════════════════════════════════════════════')
  console.log('[Orchestrator] 🏁 Run Complete')
  console.log(`  Discovered:          ${summary.totalDiscovered}`)
  console.log(`  Out of range:        ${summary.totalSkippedOutOfRange}`)
  console.log(`  Duplicates skipped:  ${summary.totalSkippedDuplicate}`)
  console.log(`  Enriched:            ${summary.totalEnriched}`)
  console.log(`  Qualified (saved):   ${summary.totalQualified}`)
  console.log(`  Rejected:            ${summary.totalRejected}`)
  console.log(`  Errors:              ${summary.errors.length}`)
  console.log(`  Duration:            ${(summary.durationMs / 1000).toFixed(1)}s`)
  console.log('══════════════════════════════════════════════\n')

  return summary
}
```

---

## Run Flow Diagram

```
runAutonomousScouting(campaign)
       │
       ├─ Step 1: generateSearchQueries()     → string[]
       │          [LLM call — Groq, 1 req]
       │
       ├─ Step 2: executeYouTubeSearch()      → DiscoveredChannel[]
       │          [YouTube API — 100 units × N queries]
       │
       ├─ Step 3: filterBySubscriberRange()   → DiscoveredChannel[] (filtered)
       │          [YouTube API — 1 unit per batch of 50]
       │
       └─ For each channel in filtered list:
              │
              ├─ Gate 1: isChannelInSupabase()?  → skip + OmniHub log if YES
              ├─ Gate 2: hasChannelBeenProcessed()? → skip if YES
              │
              ├─ Step 4a: fetchAllYouTubeData()   → YouTubeEnrichmentResult
              │           [Existing pipeline — channels.list + playlistItems]
              │
              ├─ Step 4b: mapEnrichmentToSnapshot() → ChannelSnapshot
              │
              ├─ Step 4c: qualifyChannel()          → QualificationResult
              │           [LLM call — Groq, 1 req]
              │
              └─ Step 4d:
                   ├─ QUALIFIED → saveQualifiedLead() + logDecision('qualified_lead')
                   └─ REJECTED  → logDecision('rejected_lead')
```

---

## Completion Checklist

- [ ] `lib/autonomous/orchestrator.ts` created with the exact content above
- [ ] All imports resolve: `query-generator`, `search`, `qualifier`, `memory`, `types`, `../youtube/orchestrator`, `../youtube/types`
- [ ] `mapEnrichmentToSnapshot()` field names match your actual `YouTubeEnrichmentResult` type — adjust if needed
- [ ] `saveQualifiedLead()` column names match your actual `leads` table schema — adjust `found_by`, `draft`, `status` if different
- [ ] `npx tsc --noEmit` passes with zero new errors
- [ ] Do NOT run a full scouting run yet — that is triggered via the API route in Module 07
