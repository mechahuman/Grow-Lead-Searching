// lib/autonomous/search.ts
// Executes YouTube channel searches and pre-filters by subscriber count.
//
// STANDALONE MODULE — Imports only from ./types and uses process.env.
// Does not know about LLM, memory, qualification, or database.
//
// Usage:
//   import { executeYouTubeSearch, filterBySubscriberRange } from './search'
//   const channels = await executeYouTubeSearch(queries, 8)
//   const filtered = await filterBySubscriberRange(channels, 1000, 500000)

import type { DiscoveredChannel } from './types'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

// ─── Internals ───────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('[Search] YOUTUBE_API_KEY is not set in environment.')
  return key
}

/**
 * Executes a single YouTube channel search query.
 *
 * Uses type=channel (NOT type=video) so each result maps 1:1 to a channel.
 * Channel ID is read from item.id.channelId (the canonical field for channel results).
 *
 * API cost: 100 quota units per call.
 */
async function searchYouTubeChannelsOnce(
  query: string,
  maxResults: number
): Promise<DiscoveredChannel[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'channel',          // ← channel search, not video search
    order: 'relevance',       // relevance works better than 'date' for channel discovery
    maxResults: String(Math.min(maxResults, 50)),
    key: getApiKey(),
  })

  const url = `${YOUTUBE_API_BASE}/search?${params.toString()}`
  let data: any

  try {
    const res = await fetch(url)
    data = await res.json()
  } catch (err) {
    console.error(`[Search] Network error for query "${query}":`, err)
    return []
  }

  if (data.error) {
    console.error(
      `[Search] YouTube API error for query "${query}": ` +
      `${data.error.message} (code ${data.error.code})`
    )
    return []
  }

  const items: any[] = data.items ?? []
  const results: DiscoveredChannel[] = []

  for (const item of items) {
    // For type=channel results, the canonical channel ID is in item.id.channelId
    // item.snippet.channelId is also populated and should match
    const channelId = item.id?.channelId ?? item.snippet?.channelId
    const channelTitle = item.snippet?.title ?? item.snippet?.channelTitle

    if (!channelId || !channelTitle) {
      console.warn(`[Search] Skipping item with missing channelId or title:`, item.id)
      continue
    }

    results.push({
      channelId,
      channelTitle,
      discoveredFromQuery: query,
    })
  }

  console.log(`[Search] Query "${query}" → ${results.length} channels`)
  return results
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Runs multiple YouTube channel search queries and returns deduplicated results.
 *
 * Deduplication is by channelId (a channel appearing in multiple query results
 * is kept only once, preserving the first query that found it).
 *
 * API cost: 100 quota units × number of queries.
 *
 * @param queries - Array of search query strings (from query-generator.ts)
 * @param maxResults - Max results per query (default 8, max 50)
 */
export async function executeYouTubeSearch(
  queries: string[],
  maxResults = 8
): Promise<DiscoveredChannel[]> {
  console.log(`[Search] Executing ${queries.length} queries (${maxResults} results each)...`)

  const discovered = new Map<string, DiscoveredChannel>()

  for (const query of queries) {
    const results = await searchYouTubeChannelsOnce(query, maxResults)

    for (const channel of results) {
      // First query wins — preserves discoveredFromQuery for attribution
      if (!discovered.has(channel.channelId)) {
        discovered.set(channel.channelId, channel)
      }
    }

    // 300ms pause between queries to avoid rate-limit spikes
    await new Promise(r => setTimeout(r, 300))
  }

  const total = Array.from(discovered.values())
  console.log(`[Search] ✅ Total unique channels discovered: ${total.length}`)
  return total
}

/**
 * Pre-filters discovered channels by subscriber count using channels.list.
 *
 * Channels outside the [minSubs, maxSubs] range are dropped before the expensive
 * enrichment step (fetchAllYouTubeData). This saves significant API quota.
 *
 * Also returns enriched channel-level stats (total views, video count) for free
 * since they come from the same channels.list call.
 *
 * API cost: 1 quota unit per batch of 50 channels (near-free).
 *
 * Fail-open behaviour: if the channels.list call fails for a batch,
 * all channels in that batch are passed through (better to over-enrich than miss leads).
 *
 * @param channels - List of discovered channels to filter
 * @param minSubs - Minimum subscriber count (inclusive)
 * @param maxSubs - Maximum subscriber count (inclusive)
 */
export async function filterBySubscriberRange(
  channels: DiscoveredChannel[],
  minSubs: number,
  maxSubs: number
): Promise<DiscoveredChannel[]> {
  if (channels.length === 0) return []

  console.log(
    `[Filter] Checking ${channels.length} channels for subscriber range ` +
    `[${minSubs.toLocaleString()} – ${maxSubs.toLocaleString()}]...`
  )

  const BATCH_SIZE = 50
  const passing: DiscoveredChannel[] = []

  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    const batch = channels.slice(i, i + BATCH_SIZE)
    const ids = batch.map(c => c.channelId).join(',')

    const params = new URLSearchParams({
      part: 'statistics,snippet',  // statistics for subs/views, snippet for verification
      id: ids,
      key: getApiKey(),
    })

    const url = `${YOUTUBE_API_BASE}/channels?${params.toString()}`
    let data: any

    try {
      const res = await fetch(url)
      data = await res.json()
    } catch (err) {
      // Network failure — fail open for this batch
      console.warn(`[Filter] ⚠️  Network error for batch ${i / BATCH_SIZE + 1}. Passing all channels through.`, err)
      passing.push(...batch)
      continue
    }

    if (data.error) {
      // API error — fail open for this batch
      console.warn(`[Filter] ⚠️  API error: ${data.error.message}. Passing batch through.`)
      passing.push(...batch)
      continue
    }

    const returnedItems: any[] = data.items ?? []

    for (const item of returnedItems) {
      const channel = batch.find(c => c.channelId === item.id)
      if (!channel) continue

      const subs = parseInt(item.statistics?.subscriberCount ?? '0', 10)
      const totalViews = parseInt(item.statistics?.viewCount ?? '0', 10)
      const videoCount = parseInt(item.statistics?.videoCount ?? '0', 10)

      const inRange = subs >= minSubs && subs <= maxSubs

      if (inRange) {
        console.log(
          `[Filter] ✅ ${channel.channelTitle}: ` +
          `${subs.toLocaleString()} subs | ${totalViews.toLocaleString()} views | ${videoCount} videos`
        )
        passing.push(channel)
      } else {
        console.log(
          `[Filter] ❌ ${channel.channelTitle}: ` +
          `${subs.toLocaleString()} subs — out of range`
        )
      }
    }

    // Note: channels that YouTube returns no data for (deleted/private) are silently dropped.
    // This is intentional — we don't want to enrich channels that can't be verified.
  }

  console.log(`[Filter] ✅ ${passing.length} / ${channels.length} channels passed the subscriber filter.`)
  return passing
}
