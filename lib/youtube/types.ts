export type YouTubeUrlType = 'handle' | 'channelId' | 'legacy'

export interface ParsedYouTubeUrl {
  type: YouTubeUrlType
  value: string  // handle (no @), channelId, or legacy username
}

export interface ChannelData {
  channelId: string
  handle: string | null       // e.g. '@RyanTolmia' as returned by API
  title: string
  description: string
  channelCreatedAt: Date
  subscriberCount: number
  totalViews: number
  videoCount: number
  uploadsPlaylistId: string
  keywords: string[]
  country: string | null
  thumbnailUrl: string | null
}

export interface VideoData {
  videoId: string
  title: string
  publishedAt: Date
  viewCount: number
  likeCount: number
  commentCount: number
  durationSec: number
  descriptionSnippet: string  // first 200 chars
}

export interface AboutData {
  email: string | null
  website: string | null
  socialLinks: Array<{ platform: string; url: string }>
}

export interface YouTubeEnrichmentResult {
  channelId: string
  handle: string | null
  title: string
  description: string
  channelCreatedAt: Date
  subscriberCount: number
  totalViews: number
  videoCount: number
  lastUploadAt: Date | null
  avgViewsLast10: number | null
  s2vRatioPct: number | null
  postingFrequency30d: number   // count of videos published in last 30 days
  recentVideos: VideoData[]
  email: string | null
  website: string | null
  socialLinks: Array<{ platform: string; url: string }>
  thumbnailUrl: string | null
  rawApiResponses: {
    channel: unknown
    videoIds: unknown
    videoStats: unknown
  }
}
