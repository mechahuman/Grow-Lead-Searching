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
//   7. Save qualified channels to autonomous DB
//   8. Log all decisions to OmniHub memory

import { generateSearchQueries } from './query-generator'
import { executeYouTubeSearch, filterBySubscriberRange } from './search'
import { qualifyChannel } from './qualifier'
import type { ChannelSnapshot } from './qualifier'
import { logDecision, hasChannelBeenProcessed } from './memory'
import type { CampaignConfig, RunSummary } from './types'
import { getAutonomousSupabaseAdmin } from './supabase-client'

// ── Existing pipeline (reused, not modified) ─────────────────────────────────
import { fetchAllYouTubeData } from '../youtube/orchestrator'
import type { YouTubeEnrichmentResult } from '../youtube/types'
import Groq from 'groq-sdk'

// ─── Helper: Parse Natural Language Description ──────────────────────────────

interface ParsedCampaignDescription {
  targetMarket: string
  productDescription: string
  minSubscribers: number
  maxSubscribers: number
}

async function parseNaturalLanguageDescription(description: string): Promise<ParsedCampaignDescription> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const systemPrompt = `You are a campaign specification parser. Extract structured information from natural language campaign descriptions.

Extract and return ONLY a JSON object with these fields:
- targetMarket: a cleaned description of the channel type/niche
- productDescription: what's being promoted (or generic default if not mentioned)
- minSubscribers: minimum subscriber count (numeric, in actual count not k/M)
- maxSubscribers: maximum subscriber count (numeric, in actual count not k/M)

Rules for parsing subscriber ranges:
- "1k" means 1000, "10k" means 10000, "1M" means 1000000, etc.
- "5M", "5 million", "5000000" all mean 5,000,000
- If user says "small channels" without a number, interpret as 1000-50000
- If user says "over 5M" or "above 1M", set min to that number and max to 10M (10 million)
- If user says "millions" or "high subscriber", interpret as 1M to 10M
- If no range mentioned at all, use defaults: 1000-500000
- If only one number mentioned without "over/above/million", use it as minimum and set maximum to 500000

For productDescription:
- Extract what the user is promoting if mentioned
- If no product mentioned, use: "YouTube channel outreach and sponsorship partnership"

Return ONLY valid JSON. No markdown, no code fences.`

  const userPrompt = `Campaign description: ${description}`

  console.log('[Orchestrator] Step 0/5: Parsing natural language campaign description...')

  try {
    const completion = await groq.chat.completions.create({
      model: process.env.AUTONOMOUS_GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 256,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    console.log(`[Orchestrator] Raw parse response: ${raw}`)

    // Parse the JSON response
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    const result: ParsedCampaignDescription = {
      targetMarket: typeof parsed.targetMarket === 'string' ? parsed.targetMarket : 'YouTube channels',
      productDescription: typeof parsed.productDescription === 'string' ? parsed.productDescription : 'YouTube channel outreach and sponsorship partnership',
      minSubscribers: typeof parsed.minSubscribers === 'number' ? Math.max(1, parsed.minSubscribers) : 1000,
      maxSubscribers: typeof parsed.maxSubscribers === 'number' ? parsed.maxSubscribers : 500000,
    }

    // Sanity check: min should not exceed max
    if (result.minSubscribers > result.maxSubscribers) {
      [result.minSubscribers, result.maxSubscribers] = [result.maxSubscribers, result.minSubscribers]
    }

    console.log(`[Orchestrator] ✅ Parsed campaign:`)
    console.log(`  Target Market: "${result.targetMarket}"`)
    console.log(`  Product: "${result.productDescription}"`)
    console.log(`  Subscriber Range: ${result.minSubscribers.toLocaleString()} – ${result.maxSubscribers.toLocaleString()}`)

    return result
  } catch (err) {
    console.error(`[Orchestrator] ⚠️  Parse failed, using defaults:`, err)
    return {
      targetMarket: 'YouTube channels',
      productDescription: 'YouTube channel outreach and sponsorship partnership',
      minSubscribers: 1000,
      maxSubscribers: 500000,
    }
  }
}

// ─── Helper: Map Enrichment → Snapshot ───────────────────────────────────────

/**
 * Converts the full YouTubeEnrichmentResult (from the existing pipeline)
 * into the leaner ChannelSnapshot that the qualifier expects.
 *
 * Field name mappings:
 *   YouTubeEnrichmentResult.title → ChannelSnapshot.channelTitle
 *   YouTubeEnrichmentResult.lastUploadAt → ChannelSnapshot.lastUploadDate
 *   YouTubeEnrichmentResult.recentVideos → Extract arrays for snapshot
 */
function mapEnrichmentToSnapshot(enrichment: YouTubeEnrichmentResult): ChannelSnapshot {
  const recentVideos = enrichment.recentVideos ?? []
  const channelData = enrichment.rawApiResponses?.channel as any

  return {
    channelId: enrichment.channelId,
    channelTitle: enrichment.title,
    description: enrichment.description ?? '',
    subscriberCount: enrichment.subscriberCount ?? 0,
    totalViews: enrichment.totalViews ?? 0,
    videoCount: enrichment.videoCount ?? 0,
    country: channelData?.country ?? undefined,
    lastUploadDate: enrichment.lastUploadAt?.toISOString(),
    recentVideoTitles: recentVideos.map(v => v.title ?? '').filter(Boolean).slice(0, 5),
    recentVideoViews: recentVideos.map(v => v.viewCount ?? 0).slice(0, 5),
    recentVideoLikes: recentVideos.map(v => v.likeCount ?? 0).slice(0, 5),
    recentVideoComments: recentVideos.map(v => v.commentCount ?? 0).slice(0, 5),
  }
}

// ─── Helper: Supabase Deduplication ──────────────────────────────────────────

async function isChannelInSupabase(
  supabase: ReturnType<typeof getAutonomousSupabaseAdmin>,
  channelId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('autonomous_leads')
    .select('id')
    .eq('youtube_channel_id', channelId)
    .maybeSingle()

  if (error) {
    console.warn(`[Orchestrator] ⚠️  Supabase dedup check failed for ${channelId}:`, error.message)
    return false // Fail open — if we can't check, proceed with enrichment
  }

  return !!data
}

// ─── Helper: Save Lead Decision (Qualified or Rejected) ───────────────────────

/**
 * Saves a channel decision (qualified or rejected) to the autonomous Supabase database.
 * This provides full visibility into the discovery process.
 *
 * For qualified leads:
 *   - is_qualified: true
 *   - admin_status: 'pending' → waiting for admin review/approval
 *
 * For rejected leads:
 *   - is_qualified: false
 *   - admin_status: 'rejected' → did not meet criteria, no admin action needed
 */
async function saveLeadDecision(
  supabase: ReturnType<typeof getAutonomousSupabaseAdmin>,
  enrichment: YouTubeEnrichmentResult,
  qualification: Awaited<ReturnType<typeof qualifyChannel>>,
  campaign: CampaignConfig,
  discoveredFromQuery: string
): Promise<void> {
  const channelData = enrichment.rawApiResponses?.channel as any

  const leadPayload = {
    // ── Campaign context ────────────────────────────────────────────────────
    target_market: campaign.targetMarket,
    product_description: campaign.productDescription,
    discovered_from_query: discoveredFromQuery,

    // ── Channel identity ────────────────────────────────────────────────────
    youtube_channel_id: enrichment.channelId,
    channel_name: enrichment.title,
    channel_url: `https://www.youtube.com/channel/${enrichment.channelId}`,
    youtube_handle: enrichment.handle,

    // ── Channel stats ────────────────────────────────────────────────────────
    subscriber_count: enrichment.subscriberCount ?? 0,
    total_views: enrichment.totalViews ?? 0,
    video_count: enrichment.videoCount ?? 0,
    country: channelData?.country ?? null,
    description: (enrichment.description ?? '').slice(0, 2000),
    channel_created_at: enrichment.channelCreatedAt?.toISOString() ?? null,
    last_upload_at: enrichment.lastUploadAt?.toISOString() ?? null,
    avg_views_last_10: enrichment.avgViewsLast10 ?? null,
    s2v_ratio_pct: enrichment.s2vRatioPct ?? null,
    posting_frequency_30d: enrichment.postingFrequency30d ?? null,

    // ── LLM Qualification ────────────────────────────────────────────────────
    is_qualified: qualification.qualified,
    qualification_reason: qualification.reason,
    category: qualification.category ?? null,
    content_style: qualification.contentStyle ?? null,
    monetization_likelihood: qualification.monetization ?? null,

    // ── Admin Review Status ──────────────────────────────────────────────────
    admin_status: qualification.qualified ? 'pending' : 'rejected',
    reviewed_by: null,
    reviewed_at: null,

    // ── Raw Data for Debugging ──────────────────────────────────────────────
    raw_youtube_data: enrichment.rawApiResponses,
    raw_llm_response: {
      qualified: qualification.qualified,
      reason: qualification.reason,
      category: qualification.category,
      contentStyle: qualification.contentStyle,
      monetization: qualification.monetization,
    },
  }

  const { error } = await supabase.from('autonomous_leads').insert(leadPayload)

  if (error) {
    throw new Error(`[Orchestrator] Supabase insert failed for ${enrichment.title}: ${error.message}`)
  }

  const status = qualification.qualified ? '✅ Qualified' : '❌ Rejected'
  console.log(`[Orchestrator] 💾 Saved to autonomous DB: ${status} ${enrichment.title}`)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Runs the full autonomous scouting pipeline for a given campaign.
 *
 * This is the main entry point. Called by the API route.
 *
 * @param campaign - Campaign configuration (target market, product, subscriber range, etc.)
 * @returns RunSummary - statistics of what was discovered, qualified, rejected, etc.
 */
export async function runAutonomousScouting(campaign: CampaignConfig): Promise<RunSummary> {
  const startTime = Date.now()
  const supabase = getAutonomousSupabaseAdmin()

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

  console.log('\n══════════════════════════════════════════════')
  console.log('[Orchestrator] 🚀 Autonomous Scouting Run Started')
  console.log('══════════════════════════════════════════════\n')

  // ── Step 0: Parse natural language description (if provided) ──────────────
  const parsed = await parseNaturalLanguageDescription(campaign.targetMarket)
  const resolvedCampaign: CampaignConfig = {
    targetMarket: parsed.targetMarket,
    productDescription: parsed.productDescription,
    minSubscribers: campaign.minSubscribers ?? parsed.minSubscribers,
    maxSubscribers: campaign.maxSubscribers ?? parsed.maxSubscribers,
    queriesPerRun: campaign.queriesPerRun,
    resultsPerQuery: campaign.resultsPerQuery,
    maxQualifiedLeads: campaign.maxQualifiedLeads,
  }

  // Read config from campaign object, with env var fallbacks
  const minSubs = resolvedCampaign.minSubscribers ?? parseInt(process.env.AUTONOMOUS_MIN_SUBSCRIBERS ?? '1000', 10)
  const maxSubs = resolvedCampaign.maxSubscribers ?? parseInt(process.env.AUTONOMOUS_MAX_SUBSCRIBERS ?? '500000', 10)
  const queriesPerRun = resolvedCampaign.queriesPerRun ?? parseInt(process.env.AUTONOMOUS_QUERIES_PER_RUN ?? '4', 10)
  const resultsPerQuery = resolvedCampaign.resultsPerQuery ?? parseInt(process.env.AUTONOMOUS_RESULTS_PER_QUERY ?? '8', 10)
  const maxQualifiedLeads = resolvedCampaign.maxQualifiedLeads ?? 10

  console.log(`[Orchestrator] Target Market: "${parsed.targetMarket}"`)
  console.log(`[Orchestrator] Product: "${parsed.productDescription}"`)
  console.log(`[Orchestrator] Subscriber Range: ${minSubs.toLocaleString()} – ${maxSubs.toLocaleString()}`)
  console.log(`[Orchestrator] ℹ️  (Min parsed as: ${parsed.minSubscribers.toLocaleString()}, Max parsed as: ${parsed.maxSubscribers.toLocaleString()})`)
  console.log('══════════════════════════════════════════════\n')

  // ── Step 1: Generate search queries via LLM ──────────────────────────────
  console.log('[Orchestrator] Step 1/5: Generating search queries...')
  let queries: string[]

  try {
    const generated = await generateSearchQueries({
      targetMarket: resolvedCampaign.targetMarket,
      productDescription: resolvedCampaign.productDescription,
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
  console.log(`[Orchestrator] Filter criteria: ${minSubs.toLocaleString()} – ${maxSubs.toLocaleString()} subscribers`)
  const inRange = await filterBySubscriberRange(discovered, minSubs, maxSubs)
  summary.totalSkippedOutOfRange = discovered.length - inRange.length
  console.log(`[Orchestrator] ✅ ${inRange.length} channels within range. ${summary.totalSkippedOutOfRange} filtered out.`)

  if (inRange.length === 0) {
    console.log('[Orchestrator] ⚠️  No channels matched the subscriber range. Ending run early.')
    console.log(`[Orchestrator] 💡 Try adjusting your search criteria or use different keywords.`)
    summary.durationMs = Date.now() - startTime
    return summary
  }

  // ── Step 4: Process each channel (dedup → enrich → qualify → save) ──────
  console.log(`\n[Orchestrator] Steps 4-5/5: Processing ${inRange.length} channels (max ${maxQualifiedLeads} leads)...\n`)

  for (const channel of inRange) {
    // Early exit: stop if we've reached max qualified leads
    if (summary.totalQualified >= maxQualifiedLeads) {
      console.log(`\n[Orchestrator] ⏸️  Reached max qualified leads (${maxQualifiedLeads}). Stopping processing.`)
      break
    }
    console.log(`─────────────────────────────────────────`)
    console.log(`[Orchestrator] Processing: "${channel.channelTitle}" (${channel.channelId})`)

    // ── Gate 1: Supabase exact deduplication ────────────────────────────
    const inDB = await isChannelInSupabase(supabase, channel.channelId)
    if (inDB) {
      console.log(`[Orchestrator] ⏭️  Already in autonomous DB. Skipping.`)
      summary.totalSkippedDuplicate++

      // Log to OmniHub so future runs also skip it fast
      logDecision({
        channelId: channel.channelId,
        channelTitle: channel.channelTitle,
        reason: 'Already exists in autonomous_leads database',
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

    // ── Step 4b.5: S2V ratio pre-filter ────────────────────────────────
    const s2vRatio = enrichment.s2vRatioPct
    if (s2vRatio !== null && s2vRatio < 10) {
      const reason = `S2V ratio ${s2vRatio.toFixed(1)}% is below the 10% threshold — likely ghost or purchased audience.`
      console.log(`[Orchestrator] ❌ REJECTED (S2V pre-filter): ${reason}`)
      const rejection = { qualified: false, reason }
      try {
        await saveLeadDecision(supabase, enrichment, rejection, resolvedCampaign, channel.discoveredFromQuery)
        summary.totalRejected++
        logDecision({ channelId: channel.channelId, channelTitle: channel.channelTitle, reason, category: 'rejected_lead' })
      } catch (err) {
        summary.errors.push(`Save failed for ${channel.channelId}: ${String(err)}`)
      }
      await new Promise(r => setTimeout(r, 500))
      continue
    }

    // ── Step 4c: LLM qualification ───────────────────────────────────────
    let qualification: Awaited<ReturnType<typeof qualifyChannel>>
    try {
      qualification = await qualifyChannel(snapshot, resolvedCampaign)
    } catch (err) {
      const msg = `Qualification error for ${channel.channelId}: ${String(err)}`
      console.error(`[Orchestrator] ❌ ${msg}`)
      summary.errors.push(msg)
      continue // Skip to next channel
    }

    // ── Step 4d: Save decision (qualified or rejected) ────────────────────
    try {
      await saveLeadDecision(supabase, enrichment, qualification, resolvedCampaign, channel.discoveredFromQuery)

      if (qualification.qualified) {
        summary.totalQualified++
        logDecision({
          channelId: channel.channelId,
          channelTitle: channel.channelTitle,
          reason: qualification.reason,
          category: 'qualified_lead',
        })
      } else {
        summary.totalRejected++
        logDecision({
          channelId: channel.channelId,
          channelTitle: channel.channelTitle,
          reason: qualification.reason,
          category: 'rejected_lead',
        })
      }
    } catch (err) {
      const msg = `Save failed for ${channel.channelId}: ${String(err)}`
      console.error(`[Orchestrator] ❌ ${msg}`)
      summary.errors.push(msg)
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
