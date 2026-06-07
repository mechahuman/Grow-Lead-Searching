const BASE = 'https://www.googleapis.com/youtube/v3'

export class YouTubeApiError extends Error {
  constructor(public readonly httpStatus: number, message: string) {
    super(message)
    this.name = 'YouTubeApiError'
  }
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY not set')
  return key
}

export function buildUrl(endpoint: string, params: Record<string, string>): string {
  const p = new URLSearchParams({ ...params, key: getApiKey() })
  return `${BASE}/${endpoint}?${p.toString()}`
}

export async function ytFetch(url: string): Promise<unknown> {
  let lastErr: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url)

      if (res.status === 403) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        const msg = (body?.error?.message ?? '').toLowerCase()
        if (msg.includes('quota')) {
          throw new YouTubeApiError(503, 'YouTube quota exceeded — try again tomorrow')
        }
        throw new YouTubeApiError(500, 'YouTube API key invalid or access denied')
      }

      if (!res.ok) {
        throw new YouTubeApiError(res.status, `YouTube API error ${res.status}: ${res.statusText}`)
      }

      return await res.json()
    } catch (err) {
      if (err instanceof YouTubeApiError) throw err
      lastErr = err as Error
      if (attempt === 0) await new Promise(r => setTimeout(r, 1000))
    }
  }

  throw lastErr ?? new Error('Unknown YouTube fetch error')
}
