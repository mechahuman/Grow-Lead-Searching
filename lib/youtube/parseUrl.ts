import type { ParsedYouTubeUrl } from './types'

export function parseYouTubeUrl(url: string): ParsedYouTubeUrl {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  const host = u.hostname.replace(/^www\./, '')
  if (host !== 'youtube.com') {
    throw new Error(`Not a YouTube URL: ${url}`)
  }

  const path = u.pathname

  // /@Handle or /@Handle/about etc.
  const handleMatch = path.match(/^\/@([^/]+)/)
  if (handleMatch) {
    return { type: 'handle', value: handleMatch[1] }
  }

  // /channel/UCxxxxxxxxxxxxxxxxxxxxxxxxx
  const channelMatch = path.match(/^\/channel\/(UC[\w-]{22})/)
  if (channelMatch) {
    return { type: 'channelId', value: channelMatch[1] }
  }

  // /c/CustomName or /user/Username (legacy formats)
  const legacyMatch = path.match(/^\/(?:c|user)\/([^/]+)/)
  if (legacyMatch) {
    return { type: 'legacy', value: legacyMatch[1] }
  }

  throw new Error(`Unrecognized YouTube URL format: ${url}`)
}
