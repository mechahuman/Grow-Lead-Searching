// app/api/autonomous/run/route.ts
// POST endpoint that triggers one autonomous scouting run.
//
// Request:
//   Method: POST
//   Header: x-autonomous-secret: <AUTONOMOUS_RUN_SECRET>
//   Body (JSON):
//     {
//       "description": string,         // required: natural language campaign description
//       "maxQualifiedLeads"?: number   // optional, defaults to 5, max 50
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
  description: string
  maxQualifiedLeads?: number
}

function validateBody(body: unknown): { valid: true; data: ParsedBody } | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Request body must be a JSON object.' }
  }

  const b = body as Record<string, unknown>

  if (typeof b.description !== 'string' || b.description.trim() === '') {
    return { valid: false, error: '"description" is required and must be a non-empty string.' }
  }

  // Optional maxQualifiedLeads
  if (b.maxQualifiedLeads !== undefined) {
    const n = Number(b.maxQualifiedLeads)
    if (!Number.isFinite(n) || n < 1 || n > 50) {
      return { valid: false, error: '"maxQualifiedLeads" must be a number between 1 and 50.' }
    }
  }

  return {
    valid: true,
    data: {
      description: b.description.trim(),
      maxQualifiedLeads: b.maxQualifiedLeads !== undefined ? Math.min(50, Math.max(1, Number(b.maxQualifiedLeads))) : 5,
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

  // Build campaign config from the parsed request
  const campaign: CampaignConfig = {
    targetMarket: validation.data.description,
    productDescription: '', // Will be parsed by orchestrator
    maxQualifiedLeads: validation.data.maxQualifiedLeads,
  }

  // ── Run the orchestrator ─────────────────────────────────────────────────
  console.log(`[API/autonomous/run] Starting run with description: "${campaign.targetMarket.substring(0, 50)}..."`)

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
