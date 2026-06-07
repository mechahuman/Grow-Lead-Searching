// lib/autonomous/memory.ts
// Wraps the `omnihub-cli` binary to provide local semantic memory.
// OmniHub must be installed globally: npm install -g omnihub-cli

import { execSync } from 'child_process'

// ─── Types ──────────────────────────────────────────────────────────────────

export type MemoryCategory = 'qualified_lead' | 'rejected_lead' | 'duplicate_channel'

export interface MemoryEntry {
  channelId: string
  channelTitle: string
  reason: string
  category: MemoryCategory
}

export interface OmniSearchResult {
  raw: string
  hasQualified: boolean
  hasRejected: boolean
  hasDuplicate: boolean
}

// ─── Availability Check ──────────────────────────────────────────────────────

let _omniHubAvailable: boolean | null = null

/**
 * Returns true if omnihub-cli is installed and accessible in PATH.
 * Result is cached after the first call.
 */
export function isOmniHubAvailable(): boolean {
  if (_omniHubAvailable !== null) return _omniHubAvailable

  try {
    execSync('omnihub --version', { stdio: 'pipe' })
    _omniHubAvailable = true
    console.log('[OmniHub] ✅ omnihub-cli is available')
  } catch {
    _omniHubAvailable = false
    console.warn(
      '[OmniHub] ⚠️  omnihub-cli is not installed or not in PATH. ' +
      'Memory features disabled. Run: npm install -g omnihub-cli && omnihub reset'
    )
  }

  return _omniHubAvailable
}

// ─── Core Operations ─────────────────────────────────────────────────────────

/**
 * Logs a scouting decision into OmniHub's local vector database.
 *
 * Format logged:
 * "CHANNEL_ID:<id> TITLE:<title> REASON:<reason>"
 *
 * Fails silently if OmniHub is not available — the system continues without memory.
 */
export function logDecision(entry: MemoryEntry): void {
  if (!isOmniHubAvailable()) return

  // Build a structured log string that is both human-readable and queryable
  const content = [
    `CHANNEL_ID:${entry.channelId}`,
    `TITLE:${entry.channelTitle}`,
    `REASON:${entry.reason}`,
  ].join(' | ')

  // Safely escape for shell argument
  const sanitised = content.replace(/"/g, "'").replace(/\n/g, ' ').slice(0, 500)

  try {
    execSync(`omnihub log "${sanitised}" --category ${entry.category}`, {
      stdio: 'pipe',
      timeout: 5000,
    })
    console.log(`[OmniHub] ✅ Logged as [${entry.category}]: ${entry.channelTitle}`)
  } catch (err) {
    // Non-fatal — continue scouting even if logging fails
    console.warn(`[OmniHub] ⚠️  Failed to log decision for ${entry.channelTitle}:`, err)
  }
}

/**
 * Performs a semantic search in OmniHub's local vector database.
 *
 * Returns a structured result indicating whether the query matches
 * any previously qualified, rejected, or duplicate channels.
 *
 * Used to check: "Have we seen something similar to this channel before?"
 */
export function searchMemory(query: string): OmniSearchResult {
  const empty: OmniSearchResult = {
    raw: '',
    hasQualified: false,
    hasRejected: false,
    hasDuplicate: false,
  }

  if (!isOmniHubAvailable()) return empty

  const sanitised = query.replace(/"/g, "'").replace(/\n/g, ' ').slice(0, 200)

  try {
    const output = execSync(`omnihub search "${sanitised}"`, {
      stdio: 'pipe',
      timeout: 5000,
    }).toString()

    return {
      raw: output,
      hasQualified: output.includes('qualified_lead'),
      hasRejected: output.includes('rejected_lead'),
      hasDuplicate: output.includes('duplicate_channel'),
    }
  } catch (err) {
    console.warn(`[OmniHub] ⚠️  Search failed for query "${sanitised}":`, err)
    return empty
  }
}

/**
 * Checks if a specific channel ID has already been processed.
 *
 * Uses an exact string search (channel IDs are unique identifiers).
 * This is the first dedup gate — fast and precise.
 */
export function hasChannelBeenProcessed(channelId: string): boolean {
  if (!isOmniHubAvailable()) return false

  const result = searchMemory(`CHANNEL_ID:${channelId}`)

  // If the exact channel ID appears in any memory entry, it has been processed
  return result.raw.includes(channelId)
}

/**
 * Exports the full OmniHub memory to a markdown string.
 * Useful for debugging — shows all logged channels and their decisions.
 */
export function exportMemoryToMarkdown(): string {
  if (!isOmniHubAvailable()) return '> OmniHub not available.'

  try {
    const output = execSync('omnihub export', { stdio: 'pipe', timeout: 10000 }).toString()
    return output
  } catch (err) {
    console.warn('[OmniHub] ⚠️  Export failed:', err)
    return '> OmniHub export failed.'
  }
}
