# Module 04 — Free LLM Query Generator

> **Task for Claude Code:** Create `lib/autonomous/query-generator.ts`. This is a fully standalone module that uses the Groq LLM (free tier) to convert a campaign's target market description into concrete YouTube search query strings.

---

## Design Principle: Isolation

This module has **zero dependencies on other `autonomous/` files**. It only imports from:
- `groq-sdk` (already installed in the project as a dependency of `lib/ai/client.ts`)
- Standard Node.js `process.env`

It exports a single primary function: `generateSearchQueries()`.

---

## Why a Separate File from `search.ts`?

Module 03 (`search.ts`) is purely mechanical — it executes HTTP calls to the YouTube API. Query *generation* is a separate concern: it's an AI call that produces the inputs for search. Keeping them in separate files means:

- You can test query generation without hitting the YouTube API
- You can swap out the LLM or prompting strategy without touching the search executor
- Both can be imported independently by the orchestrator or any future module

---

## File to Create

**Path:** `c:\GROW\Audit-Tool\lib\autonomous\query-generator.ts`

```typescript
// lib/autonomous/query-generator.ts
// Generates YouTube search queries from a campaign definition using the Groq LLM.
//
// STANDALONE MODULE — No imports from other autonomous/* files.
// Only external dependency: groq-sdk (already installed).
//
// Usage:
//   import { generateSearchQueries } from './query-generator'
//   const { queries } = await generateSearchQueries({ targetMarket, productDescription })

import Groq from 'groq-sdk'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QueryGeneratorInput {
  /** Free-text description of who we're looking for. e.g. "Small tech reviewers 10k–50k subs" */
  targetMarket: string
  /** Free-text description of the product being promoted. e.g. "AI video editing software" */
  productDescription: string
  /**
   * How many queries to generate.
   * Defaults to the AUTONOMOUS_QUERIES_PER_RUN env var, or 4.
   * Keep low: each YouTube search costs 100 quota units.
   */
  count?: number
}

export interface QueryGeneratorOutput {
  /** Array of ready-to-use YouTube search strings */
  queries: string[]
  /** The raw LLM response string (for debugging/logging) */
  rawResponse: string
  /** Number of Groq API calls made (always 1) */
  apiCallCount: 1
}

// ─── Internals ───────────────────────────────────────────────────────────────

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('[QueryGenerator] GROQ_API_KEY is not set in environment.')
  return new Groq({ apiKey })
}

function getModel(): string {
  return process.env.AUTONOMOUS_GROQ_MODEL ?? 'llama-3.3-70b-versatile'
}

/**
 * System prompt for the query generation LLM call.
 *
 * Key constraints enforced by the prompt:
 * 1. Max 8 words per query — YouTube search UX norm
 * 2. No brand/channel names — we want types of channels, not specific ones
 * 3. Vary styles — broad, niche, community-oriented — maximises discovery surface
 * 4. Return ONLY a JSON array — makes parsing deterministic
 */
const SYSTEM_PROMPT = `You are a YouTube channel discovery specialist for B2B influencer outreach campaigns.

Your task: Generate targeted YouTube search queries that will surface channels matching a specific creator audience profile.

Strict rules:
- Each query must be ≤8 words — this is a YouTube search bar, not a sentence
- Vary query styles: mix broad + niche + community-style + tutorial-style queries
- Do NOT use specific brand names or channel names — use content-type descriptors
- Queries should surface active CHANNELS, not viral one-off videos
- Think about what a channel's regular viewer would search for
- Return ONLY a valid JSON array of strings, with no extra text, no markdown, no code fences

Correct output format: ["query one", "query two", "query three"]
Incorrect: Any explanation, headers, or text outside the JSON array.`

/**
 * Fallback parser for when the LLM wraps the JSON in markdown or adds explanation text.
 * Extracts all double-quoted strings from the raw response.
 */
function parseQueriesFromRaw(raw: string, count: number): string[] {
  // First try: clean and parse as JSON
  try {
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    // Extract the first JSON array found
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed)) {
        return parsed
          .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
          .slice(0, count)
      }
    }
  } catch {
    // Fall through to regex extraction
  }

  // Second try: regex-extract all quoted strings
  const matches = raw.match(/"([^"]{5,80})"/g)
  if (matches && matches.length > 0) {
    return matches
      .map(m => m.slice(1, -1).trim())
      .filter(q => q.length > 0 && !q.includes('{') && !q.includes(':'))
      .slice(0, count)
  }

  return []
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates YouTube search query strings for a campaign using the free Groq LLM.
 *
 * Groq API cost: 1 request per call. On the free tier (~14,400 req/day), this is negligible.
 *
 * @throws Error if GROQ_API_KEY is not set or the LLM returns unparseable output.
 */
export async function generateSearchQueries(
  input: QueryGeneratorInput
): Promise<QueryGeneratorOutput> {
  const count = input.count ?? parseInt(process.env.AUTONOMOUS_QUERIES_PER_RUN ?? '4', 10)
  const groq = getGroqClient()

  const userPrompt = `Target Market: ${input.targetMarket}
Product Being Promoted: ${input.productDescription}

Generate exactly ${count} YouTube search queries to discover channels that match this target market.
Return ONLY a JSON array. No explanations.`

  console.log(`[QueryGenerator] Generating ${count} queries for market: "${input.targetMarket}"`)

  const completion = await groq.chat.completions.create({
    model: getModel(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,   // Some creativity for query variety
    max_tokens: 512,    // More than enough for an array of 10 short strings
    response_format: { type: 'text' }, // We handle JSON parsing ourselves
  })

  const raw = completion.choices[0]?.message?.content ?? '[]'
  console.log(`[QueryGenerator] Raw LLM response: ${raw}`)

  const queries = parseQueriesFromRaw(raw, count)

  if (queries.length === 0) {
    throw new Error(
      `[QueryGenerator] Could not extract any queries from LLM response.\n` +
      `Model: ${getModel()}\n` +
      `Raw response: ${raw}`
    )
  }

  if (queries.length < count) {
    console.warn(
      `[QueryGenerator] ⚠️  Requested ${count} queries but only got ${queries.length}. Proceeding with available queries.`
    )
  }

  console.log(`[QueryGenerator] ✅ Generated ${queries.length} queries:`)
  queries.forEach((q, i) => console.log(`  ${i + 1}. "${q}"`))

  return {
    queries,
    rawResponse: raw,
    apiCallCount: 1,
  }
}
```

---

## How Queries Are Generated — Example

**Input:**
```
targetMarket: "Small tech reviewers covering productivity software, 10k–100k subscribers"
productDescription: "An AI-powered video editing tool that auto-cuts silence and generates b-roll"
```

**Expected output (queries array):**
```json
[
  "video editing tips for beginners",
  "productivity tools for content creators",
  "best screen recording software review",
  "tech tutorial channel for small YouTubers",
  "AI tools for video production workflow"
]
```

---

## Groq API Quota Awareness

| Parameter | Value |
|---|---|
| API calls per invocation | **1** |
| Tokens used (approx) | ~150 input + ~80 output = ~230 tokens |
| Free tier daily limit | ~14,400 requests/day |
| Effective runs/day | ~14,400 (not a bottleneck) |

---

## Error Handling Behaviour

| Scenario | Behaviour |
|---|---|
| `GROQ_API_KEY` not set | Throws immediately with clear error message |
| Groq API returns non-JSON | Regex fallback extracts quoted strings |
| Fewer queries than requested | Logs warning, proceeds with what's available |
| Zero queries extracted | Throws error — orchestrator will catch and abort the run |
| Groq API rate limit | SDK throws; orchestrator logs to `errors[]` and returns partial summary |

---

## Manual Test Script

Create `scripts/test-query-generator.mjs` at the Audit-Tool root **(delete after testing)**:

```javascript
import { config } from 'dotenv'
config({ path: '.env.local' })

// Direct Groq test (no TypeScript compilation needed)
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const result = await groq.chat.completions.create({
  model: process.env.AUTONOMOUS_GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  messages: [
    {
      role: 'user',
      content: 'Generate 3 YouTube search queries to find tech review channels for productivity software. Return only a JSON array.'
    }
  ],
  max_tokens: 200,
})
console.log('Response:', result.choices[0]?.message?.content)
```

Run: `node scripts/test-query-generator.mjs` → expect a JSON array of 3 query strings.

---

## Completion Checklist

- [ ] `lib/autonomous/query-generator.ts` created with the exact content above
- [ ] File exports: `generateSearchQueries`, `QueryGeneratorInput`, `QueryGeneratorOutput`
- [ ] Manual Groq test (`test-query-generator.mjs`) runs successfully → returns query array
- [ ] Test script deleted after verification
- [ ] `npx tsc --noEmit` passes with no new errors
