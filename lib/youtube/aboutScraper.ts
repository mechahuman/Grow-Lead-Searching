import * as cheerio from 'cheerio'
import type { AboutData } from './types'

const SOCIAL_DOMAINS: Record<string, string> = {
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'facebook.com': 'facebook',
  'linkedin.com': 'linkedin',
  'twitch.tv': 'twitch',
}

// YouTube wraps external links: https://www.youtube.com/redirect?q=https%3A%2F%2F...
function decodeYtRedirect(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') && u.pathname === '/redirect') {
      return u.searchParams.get('q') ?? url
    }
  } catch { /* ignore */ }
  return url
}

// Reliably extract a JSON blob assigned to a variable in a <script> tag.
// Uses brace-counting instead of regex to handle nested braces in the JSON value.
function extractJsonBlob(html: string, varName: string): unknown {
  const marker = `var ${varName} = `
  const start = html.indexOf(marker)
  if (start === -1) return null

  const jsonStart = start + marker.length
  if (html[jsonStart] !== '{') return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(html.slice(jsonStart, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

// Recursively find the first occurrence of a string value for a given key.
function findStringValue(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== 'object') return null
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === key && typeof v === 'string') return v
    const found = findStringValue(v, key)
    if (found !== null) return found
  }
  return null
}

// Collect all external URLs from navigationEndpoint.urlEndpoint.url patterns.
function collectExternalLinks(obj: unknown, out: string[] = []): string[] {
  if (!obj || typeof obj !== 'object') return out

  const o = obj as Record<string, unknown>

  // Pattern: { navigationEndpoint: { urlEndpoint: { url: '...' } } }
  const nav = o['navigationEndpoint'] as Record<string, unknown> | undefined
  const urlEndpoint = nav?.['urlEndpoint'] as Record<string, unknown> | undefined
  const rawUrl = urlEndpoint?.['url']
  if (typeof rawUrl === 'string') {
    const decoded = decodeYtRedirect(rawUrl)
    if (decoded.startsWith('http') && !decoded.includes('youtube.com')) {
      out.push(decoded)
    }
  }

  for (const v of Object.values(o)) {
    if (typeof v === 'object') collectExternalLinks(v, out)
  }

  return out
}

export async function scrapeAboutPage(handleOrChannelId: string, isChannelId = false): Promise<AboutData> {
  const path = isChannelId
    ? `/channel/${handleOrChannelId}/about`
    : `/@${handleOrChannelId}/about`
  const url = `https://www.youtube.com${path}`

  try {
    await new Promise(r => setTimeout(r, 300))  // polite delay

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!res.ok) {
      console.warn(`[AboutScraper] HTTP ${res.status} for ${url} — skipping`)
      return { email: null, website: null, socialLinks: [] }
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    let ytData: unknown = null
    $('script').each((_, el) => {
      if (ytData) return
      const text = $(el).text()
      if (text.includes('ytInitialData')) {
        ytData = extractJsonBlob(text, 'ytInitialData')
      }
    })

    if (!ytData) {
      console.warn(`[AboutScraper] Could not parse ytInitialData for ${url}`)
      return { email: null, website: null, socialLinks: [] }
    }

    const email = findStringValue(ytData, 'businessEmail')

    const rawLinks = collectExternalLinks(ytData)
    const seen = new Set<string>()
    const deduped = rawLinks.filter(u => { if (seen.has(u)) return false; seen.add(u); return true })

    const socialPlatforms = new Set(Object.values(SOCIAL_DOMAINS))
    let website: string | null = null
    const socialLinks: Array<{ platform: string; url: string }> = []

    for (const link of deduped) {
      try {
        const host = new URL(link).hostname.replace(/^www\./, '')
        const platform = SOCIAL_DOMAINS[host]
        if (platform && socialPlatforms.has(platform)) {
          socialLinks.push({ platform, url: link })
        } else if (!website) {
          website = link
        }
      } catch { /* invalid URL — skip */ }
    }

    return { email, website, socialLinks }

  } catch (err) {
    console.warn(`[AboutScraper] Failed for ${url}:`, err instanceof Error ? err.message : err)
    return { email: null, website: null, socialLinks: [] }
  }
}
