# Module 01 — Project Setup & Dependencies

> **Task for Claude Code:** Prepare the existing Audit-Tool project to support the autonomous scouting system. No new project is created — everything is added to the existing codebase.

---

## Prerequisites

Confirm these are already working in the project before proceeding:

```bash
# From c:\GROW\Audit-Tool
node --version       # Should be 18+
npm --version        # Should be 9+
npx next --version   # Should be 14.x
```

Also confirm `.env.local` already contains these working values (they should from prior setup):
```
YOUTUBE_API_KEY=
GROQ_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Step 1: Install OmniHub CLI (Global, One-Time)

OmniHub is a local-first CLI tool. Install it globally on the machine:

```bash
npm install -g omnihub-cli
```

After installation, initialize its local database. This resets/creates a fresh 384-dimensional vector store on the local machine:

```bash
omnihub reset
```

**Verify it works:**
```bash
omnihub log "test entry from GROW autonomous system" --category tech_stack
omnihub search "test entry"
```

You should see the entry returned with a similarity score. If this works, OmniHub is ready.

---

## Step 2: Add New Environment Variables

Open `c:\GROW\Audit-Tool\.env.local` and add the following new variables at the bottom of the file:

```dotenv
# === Autonomous Lead Scouting ===
# Number of search queries to generate per campaign run (keep low to save quota)
AUTONOMOUS_QUERIES_PER_RUN=4

# Number of YouTube results to fetch per search query (max 10 recommended)
AUTONOMOUS_RESULTS_PER_QUERY=8

# Minimum subscriber count to even bother enriching a channel (saves API quota)
AUTONOMOUS_MIN_SUBSCRIBERS=1000

# Maximum subscriber count ceiling for the target market
AUTONOMOUS_MAX_SUBSCRIBERS=500000

# Groq model to use for autonomous runs (free tier)
AUTONOMOUS_GROQ_MODEL=llama-3.3-70b-versatile

# Secret token to protect the /api/autonomous/run endpoint from public access
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTONOMOUS_RUN_SECRET=
NEXT_PUBLIC_AUTONOMOUS_RUN_SECRET=
```

Also update `c:\GROW\Audit-Tool\.env.example` with these same keys (without values) so the team knows they exist.

---

## Step 3: Create the `lib/autonomous/` Directory

Create the directory structure. Do not add any files yet — just the folder:

```
c:\GROW\Audit-Tool\lib\autonomous\
```

This directory will contain:
- `memory.ts` — OmniHub CLI wrapper (Phase 02)
- `search.ts` — Query generation + YouTube search (Phase 03 & 04)
- `qualifier.ts` — LLM qualification evaluator (Phase 05)
- `orchestrator.ts` — Main run-loop (Phase 06)

---

## Step 4: Create a TypeScript Types File

Create `c:\GROW\Audit-Tool\lib\autonomous\types.ts` with the following content:

```typescript
// lib/autonomous/types.ts
// Shared types for the autonomous lead scouting system.

/**
 * A channel discovered from a YouTube search.
 * This is the raw output from executing search queries.
 */
export interface DiscoveredChannel {
  channelId: string
  channelTitle: string
  discoveredFromQuery: string
}

/**
 * The result of the LLM qualification step.
 */
export interface QualificationResult {
  qualified: boolean
  reason: string
  category?: string
  contentStyle?: string
  monetization?: string
}

/**
 * A log entry for a single scouting decision.
 * Written into both OmniHub and (optionally) a Supabase log table.
 */
export interface ScoutingDecision {
  channelId: string
  channelTitle: string
  decision: 'qualified' | 'rejected' | 'skipped_duplicate' | 'skipped_too_small' | 'skipped_too_large'
  reason: string
  timestamp: string
}

/**
 * Configuration for a single autonomous scouting campaign run.
 */
export interface CampaignConfig {
  targetMarket: string
  productDescription: string
  minSubscribers?: number
  maxSubscribers?: number
  queriesPerRun?: number
  resultsPerQuery?: number
}

/**
 * Summary statistics returned after a campaign run completes.
 */
export interface RunSummary {
  totalDiscovered: number
  totalSkippedDuplicate: number
  totalSkippedOutOfRange: number
  totalEnriched: number
  totalQualified: number
  totalRejected: number
  errors: string[]
  durationMs: number
}
```

---

## Step 5: Verify TypeScript Compiles

After creating the types file, run a TypeScript check to make sure there are no import errors:

```bash
# From c:\GROW\Audit-Tool
npx tsc --noEmit
```

Expected: zero errors. If there are errors in existing files, do NOT fix them here — report them and continue.

---

## Completion Checklist

Before moving to Module 02, confirm:

- [ ] `omnihub-cli` is installed globally (`omnihub --version` works)
- [ ] `omnihub reset` was run successfully
- [ ] `omnihub log "test" --category tech_stack` works and `omnihub search "test"` returns the entry
- [ ] New env vars added to `.env.local` and `.env.example`
- [ ] `AUTONOMOUS_RUN_SECRET` and `NEXT_PUBLIC_AUTONOMOUS_RUN_SECRET` are populated with a generated random hex string
- [ ] `lib/autonomous/` directory exists
- [ ] `lib/autonomous/types.ts` created and contains all 6 exported types
- [ ] `npx tsc --noEmit` reports zero errors
