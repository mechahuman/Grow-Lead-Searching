import { parseYouTubeUrl } from './parseUrl'
import { fetchChannelByHandle, fetchChannelById, resolveChannelFromLegacy } from './channels'
import { fetchRecentVideoIds, fetchVideoStats } from './videos'
import { scrapeAboutPage } from './aboutScraper'
import type { ChannelData, VideoData, YouTubeEnrichmentResult } from './types'

function computeDerived(channel: ChannelData, videos: VideoData[]) {
  const sorted = [...videos].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())

  const lastUploadAt = sorted[0]?.publishedAt ?? null

  const top10 = sorted.slice(0, 10)
  const avgViewsLast10 = top10.length > 0
    ? Math.round(top10.reduce((sum, v) => sum + v.viewCount, 0) / top10.length)
    : null

  const s2vRatioPct = avgViewsLast10 !== null && channel.subscriberCount > 0
    ? Math.round((avgViewsLast10 / channel.subscriberCount) * 1000) / 10
    : null

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const postingFrequency30d = videos.filter(v => v.publishedAt > thirtyDaysAgo).length

  return { lastUploadAt, avgViewsLast10, s2vRatioPct, postingFrequency30d }
}

export async function fetchAllYouTubeData(youtubeUrl: string): Promise<YouTubeEnrichmentResult> {
  // Step 1: Parse URL
  const parsed = parseYouTubeUrl(youtubeUrl)

  // Steps 2–3: Resolve channel (includes uploads playlist ID)
  let channel: ChannelData
  if (parsed.type === 'handle') {
    channel = await fetchChannelByHandle(parsed.value)
  } else if (parsed.type === 'channelId') {
    channel = await fetchChannelById(parsed.value)
  } else {
    channel = await resolveChannelFromLegacy(parsed.value)
  }

  // Step 4: Fetch recent video IDs via uploads playlist (1 quota unit)
  const videoIds = await fetchRecentVideoIds(channel.uploadsPlaylistId, 15)

  // Step 5: Fetch video statistics (1 quota unit for ≤50 videos)
  const videos = await fetchVideoStats(videoIds)

  // Step 6: Compute derived fields
  const { lastUploadAt, avgViewsLast10, s2vRatioPct, postingFrequency30d } = computeDerived(channel, videos)

  // Step 7: Scrape About page — fails gracefully, never blocks enrichment
  const handleSlug = channel.handle?.replace(/^@/, '') ?? null
  const about = await scrapeAboutPage(
    handleSlug ?? channel.channelId,
    handleSlug === null,
  )

  // Step 8: Assemble
  return {
    channelId: channel.channelId,
    handle: channel.handle,
    title: channel.title,
    description: channel.description,
    channelCreatedAt: channel.channelCreatedAt,
    subscriberCount: channel.subscriberCount,
    totalViews: channel.totalViews,
    videoCount: channel.videoCount,
    lastUploadAt,
    avgViewsLast10,
    s2vRatioPct,
    postingFrequency30d,
    recentVideos: videos,
    email: about.email,
    website: about.website,
    socialLinks: about.socialLinks,
    thumbnailUrl: channel.thumbnailUrl,
    rawApiResponses: {
      channel,
      videoIds,
      videoStats: videos,
    },
  }
}
