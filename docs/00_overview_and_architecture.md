# Module 00 — System Overview & Architecture

> **Feed this file first to Claude Code.** It establishes the complete mental model before any code is written.

---

## What This System Does

This is an **Autonomous YouTube Lead Scouting System** that runs inside the existing **GROW Audit-Tool** codebase (Next.js 14, Supabase, TypeScript).

Instead of a human pasting one YouTube URL at a time, a user defines a **Campaign** with:
- A **Target Market** description (e.g., "Small tech reviewers with 10k–50k subscribers")
- A **Product Description** (e.g., "A video editing AI software")

The system then autonomously:
1. Converts the target market into YouTube search queries (using a free LLM via Groq)
2. Searches YouTube for **channels** (not videos) matching those queries
3. Pre-filters channels outside the target subscriber range (saves quota)
4. Deduplicates results against the Supabase database AND local OmniHub memory
5. Enriches each new channel using the existing YouTube enrichment pipeline
6. Qualifies or rejects each channel using an LLM (free Groq tier)
7. Saves qualified channels as `draft=true` leads in Supabase for human review
8. Logs all decisions (qualified or rejected) into OmniHub's local vector database

**Zero paid services are used.** All tools are on free tiers.

---

## Cost Constraints (STRICTLY FREE)

| Service | Free Tier Limit | Our Usage |
|---|---|---|
| YouTube Data API v3 | 10,000 quota units/day | `search.list` = 100 units/query, `channels.list` = 1 unit/50 channels. ~24 full runs/day at default settings. |
| Groq API | ~14,400 req/day on free tier | 1 call for query generation + 1 call per channel qualified = 2–22 calls per run. Plenty of headroom. |
| Supabase | 500MB database, 2GB bandwidth | A few hundred leads = trivial storage. |
| OmniHub CLI | 100% local, 0 cost | Runs on-device using WebAssembly. Zero network calls. |

---

## System Architecture Diagram

```
User defines Campaign (Target Market + Product)
          │
          ▼
  ┌──────────────────────┐
  │  LLM Query Generator  │  ← Free Groq API (llama-3.3-70b-versatile)
  │  lib/autonomous/      │    Module 04 → query-generator.ts
  │  query-generator.ts   │
  └──────────┬───────────┘
             │  4–10 search query strings
             ▼
  ┌──────────────────────┐
  │  YouTube Channel      │  ← YouTube Data API v3 (search.list, type=channel)
  │  Search Executor      │    100 units per query
  │  lib/autonomous/      │
  │  search.ts            │    Module 03
  └──────────┬───────────┘
             │  DiscoveredChannel[] — deduplicated by channelId
             ▼
  ┌──────────────────────┐
  │  Subscriber Range     │  ← channels.list (1 unit per 50 channels)
  │  Filter               │    Drops channels outside [minSubs, maxSubs]
  └──────────┬───────────┘
             │  Filtered DiscoveredChannel[]
             ▼
  ┌──────────────────────────────────────────┐
  │  Deduplication Gates                      │
  │  Gate 1: Supabase DB check (exact match) │
  │  Gate 2: OmniHub check (channel ID)      │  ← Local vector DB, <150ms
  └──────────┬───────────────────────────────┘
             │  Only NEW, never-seen channels pass through
             ▼
  ┌──────────────────────┐
  │  Enrichment Pipeline  │  ← REUSES existing lib/youtube/orchestrator.ts
  │  (channel stats,      │    Fetches: subscriber count, total views, video
  │   recent videos,      │    count, recent video titles + view/like/comment
  │   about page scrape)  │    counts, country, description
  └──────────┬───────────┘
             │  Full YouTubeEnrichmentResult object
             ▼
  ┌──────────────────────┐
  │  LLM Qualifier        │  ← Free Groq API (llama-3.3-70b-versatile)
  │  lib/autonomous/      │    Evaluates: content fit, audience match,
  │  qualifier.ts         │    engagement signals, professionalism
  └──────────┬───────────┘
             │
     ┌───────┴────────┐
     │                │
  QUALIFIED        REJECTED
     │                │
     ▼                ▼
 Save to          Log to OmniHub
 Supabase         as 'rejected_lead'
 (draft=true)     (prevents re-processing)
     │
     ▼
 Log to OmniHub
 as 'qualified_lead'
     │
     ▼
 Human reviews in
 /autonomous dashboard
 (sets G-factor, edits,
  saves to Google Sheets)
```

---

## Module Isolation Rule

**Each file in `lib/autonomous/` is a self-contained, independently importable module.**

| Module | File | Imports from other autonomous/* files? |
|---|---|---|
| 02 | `memory.ts` | ❌ None |
| 03 | `search.ts` | ❌ None |
| 04 | `query-generator.ts` | ❌ None |
| 05 | `qualifier.ts` | ✅ `./types` only |
| 06 | `orchestrator.ts` | ✅ All of the above + existing pipeline |

The **orchestrator is the only file that depends on multiple other modules**. All other modules can be tested, replaced, or upgraded in isolation.

---

## New Files To Create

All new files live **inside the existing Audit-Tool codebase** at `c:\GROW\Audit-Tool\`:

```
lib/
└── autonomous/
    ├── types.ts           ← Shared TypeScript interfaces (Module 01)
    ├── memory.ts          ← OmniHub CLI wrapper (Module 02)
    ├── search.ts          ← YouTube channel search + subscriber filter (Module 03)
    ├── query-generator.ts ← LLM query generation (Module 04)
    ├── qualifier.ts       ← LLM channel qualification (Module 05)
    └── orchestrator.ts    ← Main run loop — ties all modules together (Module 06)

app/
└── api/
    └── autonomous/
        └── run/
            └── route.ts   ← POST endpoint that triggers the orchestrator (Module 07)

app/
└── (authenticated)/
    └── autonomous/
        ├── page.tsx       ← Server Component page (Module 08)
        └── components/
            ├── CampaignLauncher.tsx  ← Form to start a run + status display (Module 08)
            └── DraftLeadsList.tsx    ← Table of draft leads awaiting review (Module 08)
```

---

## Existing Files This System REUSES (Do Not Modify)

| File | What it does |
|---|---|
| `lib/youtube/orchestrator.ts` | `fetchAllYouTubeData(url)` — fetches full channel enrichment |
| `lib/youtube/types.ts` | `YouTubeEnrichmentResult` type definition |
| `lib/ai/client.ts` | `callAI(system, user)` — free Groq API wrapper (not used by autonomous modules — they use groq-sdk directly for isolation) |
| `lib/scoring/` | Lead score calculation (reused when saving qualified leads) |
| `lib/supabase/` | Supabase client helpers (orchestrator uses createClient directly) |

---

## Database: No Schema Changes Required for Phase 1

The existing `leads` table already has everything we need:
- `found_by` — set to `'AUTO'` for autonomous leads
- `draft` — set to `true` so humans must review before it becomes permanent
- `status` — set to `'new'` as the initial state
- `youtube_channel_id` — used for exact deduplication
- `remarks` — used to store the LLM qualification reason

**Optional Phase 2 migrations** (covered in Module 07) add:
- A `campaigns` table for named, reusable campaign configs
- An `autonomous_run_logs` table for run history and analytics
- Additional columns on `leads` for structured qualification metadata

---

## The "Human Always Decides" Rule

This system is a **discovery and pre-qualification engine**, not an auto-closer.

- Autonomous leads land in Supabase as `draft = true`
- They appear in the `/autonomous` dashboard page
- A human reviews each one, sets the G-Factor, edits remarks, and clicks Save
- Only then does it write to Google Sheets (same flow as the manual tool)

**The existing enrichment review flow is reused end-to-end.**

---

## Environment Variables Summary

All env vars this system uses (full list — Module 01 covers setup):

```dotenv
# ── Already exist in .env.local ────────────────────────────────────
YOUTUBE_API_KEY=
GROQ_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ── New: Autonomous system config ──────────────────────────────────
AUTONOMOUS_QUERIES_PER_RUN=4
AUTONOMOUS_RESULTS_PER_QUERY=8
AUTONOMOUS_MIN_SUBSCRIBERS=1000
AUTONOMOUS_MAX_SUBSCRIBERS=500000
AUTONOMOUS_GROQ_MODEL=llama-3.3-70b-versatile
AUTONOMOUS_RUN_SECRET=           ← Server-side secret (never expose to browser)
NEXT_PUBLIC_AUTONOMOUS_RUN_SECRET=  ← Same value, for browser-triggered runs
```

---

## Reading Order for Claude Code

Feed the docs **one at a time** in this order. Complete the checklist in each module before moving to the next.

| Order | File | What it builds | Key output |
|---|---|---|---|
| 1 | `00_overview_and_architecture.md` | This file — mental model only | Understanding |
| 2 | `01_project_setup.md` | Dependencies + env vars + types file | `lib/autonomous/types.ts` |
| 3 | `02_omni_hub_memory.md` | Local vector memory wrapper | `lib/autonomous/memory.ts` |
| 4 | `03_youtube_search_engine.md` | YouTube channel search + filter | `lib/autonomous/search.ts` |
| 5 | `04_free_llm_query_generator.md` | LLM query generation | `lib/autonomous/query-generator.ts` |
| 6 | `05_qualification_pipeline.md` | LLM channel qualification | `lib/autonomous/qualifier.ts` |
| 7 | `06_orchestrator.md` | Main run loop | `lib/autonomous/orchestrator.ts` |
| 8 | `07_api_route_and_database.md` | HTTP endpoint + optional DB | `app/api/autonomous/run/route.ts` |
| 9 | `08_dashboard_ui.md` | Campaign launcher + lead review UI | `app/(authenticated)/autonomous/` |
