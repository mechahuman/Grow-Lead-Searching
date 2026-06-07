# Module 02 — OmniHub Local Memory Layer

> **Task for Claude Code:** Create `lib/autonomous/memory.ts`. This module wraps the `omnihub-cli` command-line tool to provide a local, zero-cost semantic memory layer for the scouting system. It prevents re-processing channels and builds a rejection history.

---

## Why OmniHub?

Standard deduplication uses an exact database index (`youtube_channel_id`). OmniHub adds a **semantic layer** on top:
- A channel that changed its name would pass an exact-match check but fail a semantic similarity check
- We log the *reasons* for rejection — future queries can ask "have we seen a channel like this before?"
- It is 100% local, 0 cost, and sub-250ms per query

OmniHub uses a 4-bit quantized `all-MiniLM-L6-v2` model running in WebAssembly on your CPU. No GPU, no API key, no network.
*(Note: `omnihub-cli` is a published npm package and supports Windows/macOS/Linux)*

---

## OmniHub Categories Used in This System

| Category string | Meaning |
|---|---|
| `qualified_lead` | Channel passed qualification and was saved to Supabase |
| `rejected_lead` | Channel was evaluated but did not meet criteria |
| `duplicate_channel` | Channel was skipped because it already exists in the DB |

---

## File to Create

**Path:** `c:\GROW\Audit-Tool\lib\autonomous\memory.ts`

```typescript
// lib/autonomous/memory.ts
// Wraps the `omnihub-cli` binary to provide local semantic memory.
// OmniHub must be installed globally: npm install -g omnihub-cli

import { execSync, execFileSync } from 'child_process'

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
```

---

## How the Memory is Used in the Main Loop

In the orchestrator (Phase 06), the deduplication flow will be:

```typescript
// Gate 1: Exact DB check (Supabase)
const { data: existingLead } = await supabase
  .from('leads')
  .select('id')
  .eq('youtube_channel_id', channel.channelId)
  .maybeSingle()

if (existingLead) {
  console.log(`⏭️  Already in Supabase DB. Skipping.`)
  continue
}

// Gate 2: OmniHub exact channel ID check (fast string search)
if (hasChannelBeenProcessed(channel.channelId)) {
  console.log(`⏭️  Already in OmniHub memory. Skipping.`)
  continue
}

// Gate 3 (optional): Semantic similarity check
// Only run this if you want to catch "sister channels" doing identical content
const similarity = searchMemory(channel.channelTitle)
if (similarity.hasRejected && similarity.raw.includes(channel.channelTitle)) {
  console.log(`⏭️  Semantically similar to a previously rejected channel. Skipping.`)
  continue
}
```

---

## Manual CLI Commands for Debugging

After the system runs, you can inspect its memory from the terminal:

```bash
# See all qualified leads logged
omnihub search "qualified_lead"

# See all rejected leads
omnihub search "rejected_lead"

# Search for a specific channel
omnihub search "Editor Pro Tips"

# Export everything to markdown
omnihub export > scouting_memory_export.md
```

---

## Completion Checklist

- [ ] `lib/autonomous/memory.ts` created with the exact content above
- [ ] File exports: `isOmniHubAvailable`, `logDecision`, `searchMemory`, `hasChannelBeenProcessed`, `exportMemoryToMarkdown`
- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] Manual test: `omnihub log "test channel" --category qualified_lead` works in terminal
