import { buildUrl, ytFetch } from './client'
import type { VideoData } from './types'

function parseDurationSec(iso: string): number {
  // ISO 8601: PT4M33S, PT1H2M3S, PT30S
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] ?? '0', 10) * 3600)
    + (parseInt(m[2] ?? '0', 10) * 60)
    + parseInt(m[3] ?? '0', 10)
}

export async function fetchRecentVideoIds(uploadsPlaylistId: string, maxResults = 15): Promise<string[]> {
  if (!uploadsPlaylistId) return []
  const url = buildUrl('playlistItems', {
    part: 'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
  })
  const data = await ytFetch(url) as { items?: Array<{ contentDetails: { videoId: string } }> }
  return data.items?.map(item => item.contentDetails.videoId) ?? []
}

export async function fetchVideoStats(videoIds: string[]): Promise<VideoData[]> {
  if (videoIds.length === 0) return []

  type RawVideo = {
    id: string
    snippet: { title: string; publishedAt: string; description: string }
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
    contentDetails: { duration: string }
  }

  // Batch: up to 50 IDs per call (1 quota unit)
  const url = buildUrl('videos', {
    part: 'snippet,statistics,contentDetails',
    id: videoIds.slice(0, 50).join(','),
  })
  const data = await ytFetch(url) as { items?: RawVideo[] }

  return (data.items ?? []).map(v => ({
    videoId: v.id,
    title: v.snippet.title,
    publishedAt: new Date(v.snippet.publishedAt),
    viewCount: parseInt(v.statistics.viewCount ?? '0', 10),
    likeCount: parseInt(v.statistics.likeCount ?? '0', 10),
    commentCount: parseInt(v.statistics.commentCount ?? '0', 10),
    durationSec: parseDurationSec(v.contentDetails.duration),
    descriptionSnippet: v.snippet.description.slice(0, 200),
  }))
}
