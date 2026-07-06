// lib/autonomous/qualifier.ts
// Evaluates whether a discovered YouTube channel qualifies as a campaign lead.
//
// STANDALONE MODULE — Imports only from groq-sdk and ./types.
// Does not know about search, memory, or database.
//
// Usage:
//   import { qualifyChannel } from './qualifier'
//   const result = await qualifyChannel(snapshot, campaign)

import Groq from 'groq-sdk'
import type { QualificationResult, CampaignConfig } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * A lightweight summary of a channel's stats and content signals.
 * This is built by the orchestrator from the full YouTubeEnrichmentResult.
 *
 * Deliberately not importing YouTubeEnrichmentResult here keeps this module
 * portable — it can qualify channels from any data source.
 */
export interface ChannelSnapshot {
  channelId: string
  channelTitle: string
  /** Channel's "About" page description */
  description: string
  subscriberCount: number
  totalViews: number
  videoCount: number
  country?: string
  /** ISO 8601 date of the most recent video upload */
  lastUploadDate?: string
  /** Titles of up to 5 most recent videos */
  recentVideoTitles: string[]
  /** View counts for the same recent videos (parallel array) */
  recentVideoViews?: number[]
  /** Like counts for the same recent videos (parallel array, if available) */
  recentVideoLikes?: number[]
  /** Comment counts for the same recent videos (parallel array, if available) */
  recentVideoComments?: number[]
}

// ─── Internals ───────────────────────────────────────────────────────────────

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('[Qualifier] GROQ_API_KEY is not set in environment.')
  return new Groq({ apiKey })
}

function getModel(): string {
  return process.env.AUTONOMOUS_GROQ_MODEL ?? 'llama-3.3-70b-versatile'
}

/**
 * Formats a number into a human-readable string (e.g. 1234567 → "1.2M").
 * Makes the LLM prompt more concise and token-efficient.
 */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/**
 * Calculates average engagement rate across recent videos.
 * Returns null if there is insufficient data.
 */
function calcEngagementRate(snapshot: ChannelSnapshot): string | null {
  const views = snapshot.recentVideoViews
  const likes = snapshot.recentVideoLikes

  if (!views || !likes || views.length === 0) return null

  const avgViews = views.reduce((a, b) => a + b, 0) / views.length
  const avgLikes = likes.reduce((a, b) => a + b, 0) / likes.length

  if (avgViews === 0) return null
  const rate = ((avgLikes / avgViews) * 100).toFixed(2)
  return `${rate}% like rate (avg ${formatCount(avgLikes)} likes per ${formatCount(avgViews)} views)`
}

const SYSTEM_PROMPT = `You are a B2B lead qualification specialist for a YouTube influencer outreach campaign.

Evaluate whether a YouTube channel would be a strong partnership candidate for a product.

Known niches: Yoga | Health & Fitness | Health & Medical | Spirituality & Healing | AI & Digital Skills | Self-Help | Business Coach | Coach for Coach | Career Coach | Astro | Educator | Beauty & Make-Up | 1:1 Consultant | Relationship | Import & Export | Creator | Creative Arts | Parenting | Finance & Trading | Coding & Tech | Graphics & Video Editing | Others

Qualification criteria:
1. CONTENT-PRODUCT FIT: Does this channel's content relate to the product's domain or use case?
2. AUDIENCE MATCH: Would their viewers plausibly need, want, or benefit from this product?
3. ENGAGEMENT SIGNALS: Is there evidence of real active engagement (views, likes, comments) relative to subscriber count?
4. CREATOR PROFESSIONALISM: Does this channel demonstrate consistent, quality content creation?

Disqualify if:
- Content has no clear relationship to the product or its audience
- The channel is clearly in the wrong niche (e.g., a gaming channel for a B2B accounting tool)
- If the target market references specific niches from the known niches list, REJECT any channel whose content does not clearly fit at least one of those niches
- Subscriber count far outpaces views (ghost subscribers / bought followers)
- Channel has no recent uploads (inactive > 6 months)
- Channel appears to be a personal/family vlog with no commercial relevance

Be CONSERVATIVE. Qualify only when fit is clear and strong, not marginal.

Respond ONLY with valid JSON. No commentary, no markdown, no code fences outside the JSON.

Required JSON schema:
{
  "qualified": true | false,
  "reason": "One clear sentence explaining the decision",
  "category": "tech | lifestyle | education | gaming | business | finance | health | other",
  "contentStyle": "tutorial | review | vlog | news | commentary | entertainment | other",
  "monetization": "likely | unlikely | unknown"
}`

function buildUserPrompt(snapshot: ChannelSnapshot, campaign: CampaignConfig): string {
  // Build the recent videos section
  const videoLines = snapshot.recentVideoTitles.map((title, i) => {
    const parts: string[] = [`"${title}"`]
    if (snapshot.recentVideoViews?.[i] !== undefined) {
      parts.push(`${formatCount(snapshot.recentVideoViews[i])} views`)
    }
    if (snapshot.recentVideoLikes?.[i] !== undefined) {
      parts.push(`${formatCount(snapshot.recentVideoLikes[i])} likes`)
    }
    if (snapshot.recentVideoComments?.[i] !== undefined) {
      parts.push(`${formatCount(snapshot.recentVideoComments[i])} comments`)
    }
    return `  - ${parts.join(' | ')}`
  })

  const engagementLine = calcEngagementRate(snapshot)

  return `=== CAMPAIGN CONTEXT ===
Product: ${campaign.productDescription}
Target Market: ${campaign.targetMarket}

=== CHANNEL DATA ===
Channel Name: ${snapshot.channelTitle}
Channel ID: ${snapshot.channelId}
Subscribers: ${formatCount(snapshot.subscriberCount)}
Total Channel Views: ${formatCount(snapshot.totalViews)}
Total Videos: ${snapshot.videoCount}
Country: ${snapshot.country ?? 'Unknown'}
Last Upload: ${snapshot.lastUploadDate ?? 'Unknown'}
${engagementLine ? `Engagement Rate: ${engagementLine}` : ''}

Description:
${snapshot.description.slice(0, 600).trim() || '(no description)'}

Recent Videos:
${videoLines.length > 0 ? videoLines.join('\n') : '  (no recent videos found)'}

=== TASK ===
Evaluate this channel. Return only the JSON schema specified in the system prompt.`
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluates a YouTube channel against a campaign's criteria using the Groq LLM.
 *
 * @param snapshot - Lightweight summary of the channel's data (built by orchestrator)
 * @param campaign - The active campaign configuration (target market + product)
 * @returns QualificationResult with a boolean decision and supporting metadata
 *
 * @throws Error if GROQ_API_KEY is not set.
 *         Does NOT throw on LLM parse errors — returns qualified=false with an error reason.
 */
export async function qualifyChannel(
  snapshot: ChannelSnapshot,
  campaign: CampaignConfig
): Promise<QualificationResult> {
  const groq = getGroqClient()
  const userPrompt = buildUserPrompt(snapshot, campaign)

  console.log(
    `[Qualifier] Evaluating: "${snapshot.channelTitle}" ` +
    `(${formatCount(snapshot.subscriberCount)} subs | ${formatCount(snapshot.totalViews)} views)`
  )

  const completion = await groq.chat.completions.create({
    model: getModel(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,    // Low temperature for consistent, reproducible decisions
    max_tokens: 256,     // Schema is short — 256 is more than enough
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  console.log(`[Qualifier] Raw response: ${raw}`)

  // Parse the LLM JSON response
  try {
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    const result: QualificationResult = {
      qualified: Boolean(parsed.qualified),
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'No reason provided.',
      category: typeof parsed.category === 'string' ? parsed.category : undefined,
      contentStyle: typeof parsed.contentStyle === 'string' ? parsed.contentStyle : undefined,
      monetization: typeof parsed.monetization === 'string' ? parsed.monetization : undefined,
    }

    const verdict = result.qualified ? '✅ QUALIFIED' : '❌ REJECTED'
    console.log(`[Qualifier] ${verdict}: ${result.reason}`)

    return result
  } catch (err) {
    // Non-fatal parse error — reject the lead and log the failure
    const errorReason = `LLM returned unparseable response. Raw: "${raw.slice(0, 120)}"`
    console.error(`[Qualifier] ⚠️  JSON parse failed for "${snapshot.channelTitle}". ${errorReason}`)

    return {
      qualified: false,
      reason: errorReason,
    }
  }
}

// ─── Batch API ───────────────────────────────────────────────────────────────

/**
 * Qualifies multiple channels sequentially with a delay between each call.
 * Prevents Groq rate limiting on the free tier.
 *
 * @param snapshots - Array of channel snapshots to evaluate
 * @param campaign - Campaign config to evaluate against
 * @param delayMs - Milliseconds to wait between each Groq API call (default: 300ms)
 */
export async function qualifyChannelBatch(
  snapshots: ChannelSnapshot[],
  campaign: CampaignConfig,
  delayMs = 300
): Promise<Map<string, QualificationResult>> {
  const results = new Map<string, QualificationResult>()

  for (const snapshot of snapshots) {
    const result = await qualifyChannel(snapshot, campaign)
    results.set(snapshot.channelId, result)

    // Throttle between calls
    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }

  return results
}
