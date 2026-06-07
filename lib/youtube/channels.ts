import { buildUrl, ytFetch, YouTubeApiError } from './client'
import type { ChannelData } from './types'

// contentDetails needed for uploads playlist ID (playlistItems.list approach, 1 quota unit)
const PARTS = 'snippet,statistics,brandingSettings,contentDetails'

type RawChannelItem = {
  id: string
  snippet: {
    title: string
    description: string
    publishedAt: string
    customUrl?: string
    country?: string
    thumbnails?: {
      default?: { url: string }
      medium?: { url: string }
      high?: { url: string }
    }
  }
  statistics: {
    subscriberCount?: string
    viewCount?: string
    videoCount?: string
  }
  brandingSettings?: { channel?: { keywords?: string } }
  contentDetails?: { relatedPlaylists?: { uploads?: string } }
}

function parseKeywords(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.match(/"[^"]+"|[^\s"]+/g)?.map(k => k.replace(/"/g, '')) ?? []
}

function parseItem(item: RawChannelItem): ChannelData {
  const thumbnails = item.snippet.thumbnails
  const thumbnailUrl = thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null

  return {
    channelId: item.id,
    handle: item.snippet.customUrl ?? null,
    title: item.snippet.title,
    description: item.snippet.description,
    channelCreatedAt: new Date(item.snippet.publishedAt),
    subscriberCount: parseInt(item.statistics.subscriberCount ?? '0', 10),
    totalViews: parseInt(item.statistics.viewCount ?? '0', 10),
    videoCount: parseInt(item.statistics.videoCount ?? '0', 10),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? '',
    keywords: parseKeywords(item.brandingSettings?.channel?.keywords),
    country: item.snippet.country ?? null,
    thumbnailUrl,
  }
}

async function fetchChannel(params: Record<string, string>): Promise<ChannelData> {
  const url = buildUrl('channels', { part: PARTS, ...params })
  const data = await ytFetch(url) as { items?: RawChannelItem[] }
  if (!data.items || data.items.length === 0) {
    throw new YouTubeApiError(404, `Channel not found for params: ${JSON.stringify(params)}`)
  }
  return parseItem(data.items[0])
}

export async function fetchChannelByHandle(handle: string): Promise<ChannelData> {
  const forHandle = handle.startsWith('@') ? handle : `@${handle}`
  return fetchChannel({ forHandle })
}

export async function fetchChannelById(channelId: string): Promise<ChannelData> {
  return fetchChannel({ id: channelId })
}

export async function resolveChannelFromLegacy(username: string): Promise<ChannelData> {
  // search.list costs 100 units — only used for legacy /c/ and /user/ URLs
  console.warn(`[YouTube] Legacy URL — using search.list for "${username}" (100 quota units)`)
  const url = buildUrl('search', { part: 'id', q: username, type: 'channel', maxResults: '1' })
  const data = await ytFetch(url) as { items?: Array<{ id: { channelId: string } }> }
  if (!data.items || data.items.length === 0) {
    throw new YouTubeApiError(404, `Channel not found for legacy username: ${username}`)
  }
  return fetchChannelById(data.items[0].id.channelId)
}
