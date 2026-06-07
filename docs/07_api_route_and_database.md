# Module 07 — API Route & Database

> **Task for Claude Code:** Create `app/api/autonomous/run/route.ts`. This is the Next.js API endpoint that triggers the orchestrator. It handles authentication, input validation, and returns a run summary. Optionally, it creates two new Supabase tables for campaign and run logging.

---

## Design Principle: Isolation

This module is the only HTTP entry point into the autonomous system. It:
- Validates the incoming request (auth token + input fields)
- Calls `runAutonomousScouting()` from the orchestrator
- Returns the `RunSummary` as JSON

It does **not** contain any business logic. All logic lives in the orchestrator and its sub-modules.

---

## Authentication Strategy

The endpoint is protected by a **static secret token** sent as a request header. This prevents accidental or malicious public triggering.

- Header name: `x-autonomous-secret`
- Header value: the `AUTONOMOUS_RUN_SECRET` env var (a 64-char random hex string)
- If the header is missing or incorrect → `401 Unauthorized`

> **Why not session-based auth?** The endpoint is designed to be callable from:
> 1. The browser UI (authenticated users trigger runs)
> 2. A future cron job / external scheduler
> A shared secret works for both without additional middleware.

---

## File to Create

**Path:** `c:\GROW\Audit-Tool\app\api\autonomous\run\route.ts`

```typescript
// app/api/autonomous/run/route.ts
// POST endpoint that triggers one autonomous scouting run.
//
// Request:
//   Method: POST
//   Header: x-autonomous-secret: <AUTONOMOUS_RUN_SECRET>
//   Body (JSON):
//     {
//       "targetMarket": string,       // required
//       "productDescription": string, // required
//       "minSubscribers"?: number,    // optional, defaults to env var
//       "maxSubscribers"?: number,    // optional, defaults to env var
//       "queriesPerRun"?: number,     // optional, defaults to env var
//       "resultsPerQuery"?: number    // optional, defaults to env var
//     }
//
// Response (200): RunSummary JSON object
// Response (400): { error: string } — missing/invalid fields
// Response (401): { error: string } — invalid or missing secret
// Response (405): { error: string } — wrong HTTP method
// Response (500): { error: string, detail: string } — orchestrator threw

import { NextRequest, NextResponse } from 'next/server'
import { runAutonomousScouting } from '@/lib/autonomous/orchestrator'
import type { CampaignConfig } from '@/lib/autonomous/types'

// ─── Auth Guard ───────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.AUTONOMOUS_RUN_SECRET

  // If no secret is configured, the endpoint is disabled entirely
  if (!secret || secret.trim() === '') {
    console.error('[API/autonomous/run] AUTONOMOUS_RUN_SECRET is not set. Endpoint disabled.')
    return false
  }

  const providedSecret = request.headers.get('x-autonomous-secret')
  return providedSecret === secret
}

// ─── Input Validation ─────────────────────────────────────────────────────────

interface ParsedBody {
  targetMarket: string
  productDescription: string
  minSubscribers?: number
  maxSubscribers?: number
  queriesPerRun?: number
  resultsPerQuery?: number
}

function validateBody(body: unknown): { valid: true; data: ParsedBody } | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Request body must be a JSON object.' }
  }

  const b = body as Record<string, unknown>

  if (typeof b.targetMarket !== 'string' || b.targetMarket.trim() === '') {
    return { valid: false, error: '"targetMarket" is required and must be a non-empty string.' }
  }

  if (typeof b.productDescription !== 'string' || b.productDescription.trim() === '') {
    return { valid: false, error: '"productDescription" is required and must be a non-empty string.' }
  }

  // Optional numeric fields
  const optionalNumber = (key: string): { valid: false; error: string } | { value?: number } => {
    if (b[key] === undefined) return { value: undefined }
    const n = Number(b[key])
    if (!Number.isFinite(n) || n < 0) {
      return { valid: false, error: `"${key}" must be a non-negative number.` }
    }
    return { value: n }
  }

  for (const key of ['minSubscribers', 'maxSubscribers', 'queriesPerRun', 'resultsPerQuery']) {
    const result = optionalNumber(key)
    if ('valid' in result && !result.valid) return result
  }

  return {
    valid: true,
    data: {
      targetMarket: b.targetMarket.trim(),
      productDescription: (b.productDescription as string).trim(),
      minSubscribers: b.minSubscribers !== undefined ? Number(b.minSubscribers) : undefined,
      maxSubscribers: b.maxSubscribers !== undefined ? Number(b.maxSubscribers) : undefined,
      queriesPerRun: b.queriesPerRun !== undefined ? Number(b.queriesPerRun) : undefined,
      resultsPerQuery: b.resultsPerQuery !== undefined ? Number(b.resultsPerQuery) : undefined,
    },
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[API/autonomous/run] POST received')

  // ── Auth check ───────────────────────────────────────────────────────────
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid x-autonomous-secret header.' },
      { status: 401 }
    )
  }

  // ── Parse and validate body ──────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body is not valid JSON.' },
      { status: 400 }
    )
  }

  const validation = validateBody(rawBody)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const campaign: CampaignConfig = validation.data

  // ── Run the orchestrator ─────────────────────────────────────────────────
  console.log(`[API/autonomous/run] Starting run for: "${campaign.targetMarket}"`)

  try {
    const summary = await runAutonomousScouting(campaign)

    console.log(`[API/autonomous/run] Run complete. Qualified: ${summary.totalQualified}, Errors: ${summary.errors.length}`)

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[API/autonomous/run] Orchestrator threw an unhandled error:', detail)

    return NextResponse.json(
      {
        error: 'Orchestrator failed with an unexpected error.',
        detail,
      },
      { status: 500 }
    )
  }
}

// Reject all non-POST methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 })
}
```

---

## How to Test the Endpoint

Once the dev server is running (`npm run dev`), test with curl or a REST client:

```bash
# Generate the secret first (if not already in .env.local)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Then call the endpoint
curl -X POST http://localhost:3000/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "x-autonomous-secret: YOUR_SECRET_HERE" \
  -d '{
    "targetMarket": "Small tech review channels, 10k–100k subscribers",
    "productDescription": "AI video editing software that auto-cuts silence",
    "queriesPerRun": 2,
    "resultsPerQuery": 5
  }'
```

**Expected successful response:**
```json
{
  "success": true,
  "summary": {
    "totalDiscovered": 12,
    "totalSkippedDuplicate": 2,
    "totalSkippedOutOfRange": 4,
    "totalEnriched": 6,
    "totalQualified": 3,
    "totalRejected": 3,
    "errors": [],
    "durationMs": 14200
  }
}
```

---

## Optional: Supabase Schema Additions (Phase 2)

These tables are **not required for Phase 1** but enable a richer dashboard in Module 08.

Run these migrations in your Supabase SQL editor when ready:

### Table 1: `campaigns`

```sql
-- Stores the target market + product description for each campaign
CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  target_market       TEXT NOT NULL,
  product_description TEXT NOT NULL,
  min_subscribers     INTEGER DEFAULT 1000,
  max_subscribers     INTEGER DEFAULT 500000,
  queries_per_run     INTEGER DEFAULT 4,
  results_per_query   INTEGER DEFAULT 8,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

-- Only authenticated users can read their own campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_own" ON campaigns
  FOR ALL USING (auth.uid() = created_by);
```

### Table 2: `autonomous_run_logs`

```sql
-- Logs the summary of each automated scouting run
CREATE TABLE IF NOT EXISTS autonomous_run_logs (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id           UUID REFERENCES campaigns(id),
  target_market         TEXT NOT NULL,
  product_description   TEXT NOT NULL,
  total_discovered      INTEGER DEFAULT 0,
  total_skipped_duplicate    INTEGER DEFAULT 0,
  total_skipped_out_of_range INTEGER DEFAULT 0,
  total_enriched        INTEGER DEFAULT 0,
  total_qualified       INTEGER DEFAULT 0,
  total_rejected        INTEGER DEFAULT 0,
  errors                JSONB DEFAULT '[]',
  duration_ms           INTEGER DEFAULT 0,
  triggered_by          TEXT DEFAULT 'manual',  -- 'manual' | 'cron' | 'api'
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Public read for authenticated users (run logs are not sensitive)
ALTER TABLE autonomous_run_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "run_logs_read" ON autonomous_run_logs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "run_logs_insert_service" ON autonomous_run_logs
  FOR INSERT WITH CHECK (TRUE); -- Service role key bypasses RLS anyway
```

### Column Addition to `leads` (Optional)

If you want to link a lead back to the campaign that found it:

```sql
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS campaign_target_market TEXT,
  ADD COLUMN IF NOT EXISTS auto_qualification_reason TEXT,
  ADD COLUMN IF NOT EXISTS auto_category TEXT;
```

> **If you add these columns**, update `saveQualifiedLead()` in `orchestrator.ts` to use them instead of packing everything into `remarks`.

---

## Completion Checklist

- [ ] `app/api/autonomous/run/route.ts` created with exact content above
- [ ] `AUTONOMOUS_RUN_SECRET` is populated in `.env.local` (non-empty)
- [ ] `npm run dev` starts without errors
- [ ] `POST /api/autonomous/run` with correct secret returns `200` + `RunSummary`
- [ ] `POST /api/autonomous/run` with wrong secret returns `401`
- [ ] `POST /api/autonomous/run` with missing `targetMarket` returns `400`
- [ ] *(Optional)* Supabase migrations for `campaigns` and `autonomous_run_logs` applied
