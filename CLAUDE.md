# GROW Autonomous YouTube Lead Discovery System - Development Context

**Last Updated:** 2026-05-23  
**Status:** Core system complete and functional. UI fully displays all discovered leads with qualification status.

---

## Project Overview

The **Autonomous Lead Discovery System** is a standalone Next.js application that:
- 🤖 Autonomously finds YouTube channels matching specific criteria (target market + product description)
- 🔍 Enriches them with comprehensive YouTube data (subscribers, views, posting frequency, engagement)
- 🧠 Qualifies them using Groq LLM with conservative criteria
- 💾 Saves qualified AND rejected leads to a separate Supabase database for full visibility
- 📊 Provides an admin UI to view all processed channels with decision reasons
- 🔐 Includes API endpoint for programmatic discovery triggering

**Key Principle:** This is a completely independent system from the Audit Tool. They share only API keys for YouTube and Groq.

---

## Architecture & Technology Stack

### Frontend/API
- **Next.js 14** with App Router
- **React 18** (client & server components)
- **TypeScript** (strict mode)
- **Tailwind CSS** with custom dark theme (purple/pink accent)
- **Supabase Client** for database queries

### Backend Services
- **Groq LLM** (free tier) — Used for:
  - Query generation (4-8 word search queries for YouTube)
  - Channel qualification (conservative scoring: 0.2 temperature)
- **YouTube Data API** — Channel & video statistics
- **Supabase** (separate project) — Autonomous leads database

### Optional Enhancement
- **OmniHub CLI** with Bun — Local semantic memory for deduplication (gracefully optional)

---

## Directory Structure

```
/Autonomous-Lead/
├── app/
│   ├── api/autonomous/run/route.ts          # POST endpoint with auth guard
│   ├── (authenticated)/autonomous/
│   │   ├── page.tsx                         # Server: fetches all leads
│   │   └── components/
│   │       ├── DiscoveryLauncher.tsx        # Form: target market, product, advanced settings
│   │       └── DiscoveredLeadsList.tsx      # Table: all leads with status badges
│   ├── layout.tsx                           # Root layout with dark theme
│   └── favicon.ico, manifest.json
├── lib/
│   ├── autonomous/                          # Core discovery pipeline
│   │   ├── types.ts                         # All TypeScript interfaces
│   │   ├── supabase-client.ts               # getAutonomousSupabaseAdmin/Client
│   │   ├── memory.ts                        # OmniHub semantic memory (optional)
│   │   ├── search.ts                        # YouTube search + subscriber filtering
│   │   ├── query-generator.ts               # LLM: generates 4-8 word queries
│   │   ├── qualifier.ts                     # LLM: qualifies channels (conservative)
│   │   └── orchestrator.ts                  # MAIN: full pipeline coordination
│   └── youtube/                             # Reused from Audit Tool
│       ├── types.ts, client.ts, parseUrl.ts, channels.ts, videos.ts, aboutScraper.ts, orchestrator.ts, index.ts
│
├── .env.local                               # Secrets (API keys, Supabase creds, config)
├── package.json                             # Dependencies
├── tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.mjs
├── globals.css                              # Design tokens & animations
└── CLAUDE.md                                # This file
```

---

## Key Components & How They Work

### 1. Discovery Launcher (`DiscoveryLauncher.tsx`)
**Purpose:** User interface for starting discovery runs

**Inputs:**
- `targetMarket` — Market to find (e.g., "fitness coaching")
- `productDescription` — What you're selling (e.g., "online personal training platform")
- **Advanced Settings:**
  - `minSubscribers` — Filter out channels below this (default: 1,000)
  - `maxSubscribers` — Filter out channels above this (default: 500,000)
  - `queriesPerRun` — How many YouTube queries to generate (1-10, default: 4)
  - `resultsPerQuery` — Results per query (1-50, default: 8)
  - `maxQualifiedLeads` — Stop processing once this many qualified leads found (default: 10)

**Flow:**
1. Validates inputs (required fields, numeric ranges)
2. Calls `/api/autonomous/run` with `x-autonomous-secret` header
3. Displays real-time status: spinner → success stats or errors
4. Shows: Discovered, Enriched, Qualified, Rejected, Duration, Error list (expandable)

---

### 2. Orchestrator (`orchestrator.ts`) — Main Pipeline
**Entry point:** `runAutonomousScouting(campaign: CampaignConfig)`

**Steps (in order):**

| Step | What It Does | Output |
|------|---|---|
| 1 | LLM generates 4-8 word YouTube search queries | Array of queries |
| 2 | Execute YouTube searches for channels | List of channel IDs + titles |
| 3 | Pre-filter by subscriber range | Channels within min-max range |
| 4 (loop) | For each channel: |  |
| 4.1 | Supabase exact dedup check | Skip if already in DB |
| 4.2 | OmniHub memory check (optional) | Skip if processed before |
| 4.3 | Enrich via YouTube pipeline | Full channel stats |
| 4.4 | LLM qualification | Qualified: true/false + reason |
| 4.5 | **Save decision to Supabase** | Both qualified AND rejected |
| 4.6 | Log to OmniHub memory | For future runs |
| 5 | Early exit | Stop if `totalQualified >= maxQualifiedLeads` |

**Rate Limiting:**
- 300ms delay between YouTube queries
- 500ms delay between channel processing
- Batching: YouTube `channels.list` supports 50 per request

**Error Handling:**
- Fail-open: Network errors don't stop the pipeline
- Missing enrichment data → qualification still proceeds with available fields
- Errors collected in `summary.errors[]` but run completes

---

### 3. Query Generator (`query-generator.ts`)
**Purpose:** Generate creative 4-8 word YouTube search queries using Groq LLM

**System Prompt Requirements:**
- Each query must be 4-8 words exactly
- Queries should find channels matching the target market
- Mix specificity (3-4 queries) + breadth (1-2 broader queries)
- Temperature 0.7 for creativity

**Response Format:**
- Expects JSON: `{ queries: string[] }`
- Fallback parser handles markdown-wrapped JSON or explanatory text

**Example:**
```
Input: target="fitness coaching", product="personal training platform"
Output: [
  "online personal fitness coaching",
  "fitness trainer certification courses",
  "virtual fitness coaching business",
  "fitness instructor youtube channel"
]
```

---

### 4. Qualifier (`qualifier.ts`)
**Purpose:** LLM evaluates channels against criteria using `ChannelSnapshot`

**ChannelSnapshot Fields (from enrichment):**
- channelId, channelTitle, description, subscriberCount, totalViews, videoCount
- country, lastUploadDate
- recentVideoTitles (up to 5), recentVideoViews, recentVideoLikes, recentVideoComments

**Qualification Logic:**
- Temperature 0.2 (very consistent, conservative)
- Looks for: Regular uploads, engaged audience, on-topic content, reasonable monetization likelihood
- Returns: `{ qualified: boolean, reason: string, category, contentStyle, monetization }`

**Conservative Criteria:**
- Requires recent activity (last upload < 30 days)
- Needs consistent engagement metrics
- Rejects: Gaming, tech reviews, unrelated content
- Accepts: Educational, how-to, lifestyle, business, health content

---

### 5. Search (`search.ts`)
**Functions:**
- `executeYouTubeSearch(queries, resultsPerQuery)` — Searches with type=channel (not video)
- `filterBySubscriberRange(channels, minSubs, maxSubs)` — Applies min/max subscriber filters

**Deduplication:**
Returns only unique channels (by channelId) even if found in multiple queries.

---

### 6. Discovered Leads Table (`DiscoveredLeadsList.tsx`)
**Purpose:** Display all processed channels with their decision status

**What's Shown:**
- **Channel Name** (YouTube link)
- **Subscribers** (formatted: 1.5K, 100K, 2.3M)
- **Views** (same formatting)
- **Category** (from LLM: Education, Lifestyle, etc.)
- **Decision & Reason** — Status badge + explanation:
  - ✅ **Qualified** (green badge, normal row background)
  - ❌ **Rejected** (red badge, subtle red row background)
- **Discovery Date** (when it was found)

**Data Source:** Queries `autonomous_leads` table, fetches all leads (no filters).

---

## Supabase Database Schema

### `autonomous_leads` Table
Required columns (Supabase will create):

```sql
-- Identifiers
id: uuid, primary key
youtube_channel_id: text, unique
channel_name: text
channel_url: text
youtube_handle: text (nullable)

-- Stats
subscriber_count: bigint
total_views: bigint
video_count: integer
country: text (nullable)
description: text (2000 char max)
channel_created_at: timestamp (nullable)
last_upload_at: timestamp (nullable)
avg_views_last_10: numeric (nullable)
s2v_ratio_pct: numeric (nullable)
posting_frequency_30d: numeric (nullable)

-- Discovery context
target_market: text
product_description: text
discovered_from_query: text

-- LLM Qualification
is_qualified: boolean
qualification_reason: text
category: text (nullable) -- "Education", "Lifestyle", etc.
content_style: text (nullable)
monetization_likelihood: text (nullable)

-- Admin workflow
admin_status: text -- "pending" (needs review) or "rejected" (ineligible)
reviewed_by: text (nullable)
reviewed_at: timestamp (nullable)

-- Raw data for debugging
raw_youtube_data: jsonb
raw_llm_response: jsonb

-- Metadata
created_at: timestamp, default now()
updated_at: timestamp, default now()
```

---

## Configuration (`.env.local`)

### Supabase (Autonomous Project)
```
NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL=https://cigeghddmtdqgsxzkzxo.supabase.co
NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY=eyJhbGc...
AUTONOMOUS_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### APIs (Shared from Audit Tool)
```
YOUTUBE_API_KEY=AIza...
GROQ_API_KEY=gsk_...
```

### Discovery Configuration (Optional)
```
AUTONOMOUS_QUERIES_PER_RUN=4
AUTONOMOUS_RESULTS_PER_QUERY=8
AUTONOMOUS_MIN_SUBSCRIBERS=1000
AUTONOMOUS_MAX_SUBSCRIBERS=500000
AUTONOMOUS_GROQ_MODEL=llama-3.3-70b-versatile
```

### API Security
```
AUTONOMOUS_RUN_SECRET=<32-char hex string>
NEXT_PUBLIC_AUTONOMOUS_RUN_SECRET=<same value for browser>
```

**Generate secret:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## API Endpoint

### POST `/api/autonomous/run`
Triggers a discovery run (server-side operation).

**Authentication:**
```
Header: x-autonomous-secret: <AUTONOMOUS_RUN_SECRET>
```

**Request Body:**
```json
{
  "targetMarket": "fitness coaching",
  "productDescription": "online personal training platform",
  "minSubscribers": 1000,
  "maxSubscribers": 500000,
  "queriesPerRun": 4,
  "resultsPerQuery": 8,
  "maxQualifiedLeads": 10
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "summary": {
    "totalDiscovered": 32,
    "totalSkippedDuplicate": 0,
    "totalSkippedOutOfRange": 2,
    "totalEnriched": 1,
    "totalQualified": 1,
    "totalRejected": 0,
    "errors": [],
    "durationMs": 8700
  }
}
```

---

## Current Status & What's Working

### ✅ Completed & Tested
- [x] Core orchestrator pipeline (all 5 steps)
- [x] Query generation (LLM)
- [x] YouTube search & enrichment
- [x] Channel qualification (LLM)
- [x] Supabase integration (saving both qualified & rejected)
- [x] UI discovery form with advanced settings
- [x] Discovered leads table showing all decisions
- [x] API endpoint with auth guard
- [x] Database queries fixed (fetches all leads, not just qualified)
- [x] Row styling: Rejected leads highlighted, status badges added
- [x] Error handling throughout (network, parsing, API failures)

### 🔄 In Progress / Next Phase
- [ ] OmniHub installation (provided below)
- [ ] Admin dashboard for lead approval workflow (Phase 2)
- [ ] Integration with Audit Tool (sync API to move approved leads)
- [ ] Real-time notifications to admin (Supabase webhooks → email)
- [ ] Team member assignment workflow

---

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure `.env.local`
Copy `.env.example`, fill in:
- Supabase credentials (3 values)
- YouTube API key
- Groq API key
- Optional: AUTONOMOUS_RUN_SECRET (generate if needed)

### 3. Run Dev Server
```bash
npm run dev
```
Visit: http://localhost:3000/autonomous

### 4. Run Discovery
1. Enter target market (e.g., "fitness coaching")
2. Enter product description (e.g., "personal training app")
3. Click "Start Discovery"
4. Watch console for real-time progress
5. Scroll down to see discovered leads in the table

---

## OmniHub Installation (Optional but Recommended)

OmniHub provides semantic memory for deduplication across discovery runs. This is **optional** — the system works fine without it (falls back to Supabase exact ID matching).

### Prerequisites
- **Bun runtime** (required by OmniHub)
- Node.js 18+

### Installation Steps

#### Step 1: Install Bun
On Windows PowerShell:
```powershell
powershell -Command "iwr https://bun.sh/install.ps1 | iex"
```

Or download from https://bun.sh and run the installer.

Verify:
```bash
bun --version
```

#### Step 2: Install OmniHub CLI
```bash
npm install -g omnihub-cli
# or with bun:
bun install -g omnihub-cli
```

#### Step 3: Initialize OmniHub in Project
```bash
# In /Autonomous-Lead directory:
omnihub init
# This creates .omnihub/ directory with semantic memory index
```

#### Step 4: Test OmniHub
```bash
omnihub status
# Should show: "OmniHub is ready"
```

#### Step 5: Verify System Detection
Run a discovery. Logs should show:
```
[Memory] OmniHub is available
[Memory] Checking if channel X has been processed...
[Orchestrator] Already processed in OmniHub memory. Skipping.
```

If OmniHub is not available, logs show:
```
[Memory] OmniHub is not available (bun.exe not found)
[Orchestrator] Proceeding without semantic memory (using Supabase dedup only)
```

---

## Known Issues & Gotchas

### 1. Supabase Credentials
- ⚠️ **Critical:** Anon key and service role key must be correct (not placeholder strings)
- If you see "Invalid API key" errors, verify `.env.local` has real credentials
- Generate a new key in Supabase Dashboard if needed

### 2. YouTube API Quota
- Each query costs 100 quota units
- Each channel.list request (up to 50 channels) costs 1 unit
- Default: 4 queries × 8 results = 32 channels = ~12 quota units per run
- Free tier: 10,000 units/day (safe for testing)

### 3. Groq API Rate Limiting
- Free tier: Some rate limits apply
- Recommended: 300ms between queries (already in code)
- If hitting limits, increase delay in orchestrator.ts line 328

### 4. OmniHub Optional
- System works fine without Bun/OmniHub installed
- Falls back to Supabase exact ID dedup automatically
- If you install Bun later, OmniHub will auto-activate

---

## Testing Checklist

### Manual Testing
- [ ] Run discovery with sample market + product
- [ ] Verify: Discovered count > 0
- [ ] Verify: Enriched count > 0
- [ ] Verify: Some leads marked ✅ Qualified, some ❌ Rejected
- [ ] Check table rows: Red background for rejected, reason text visible
- [ ] Click YouTube link: Opens channel in new tab
- [ ] Test API directly: `curl -X POST http://localhost:3000/api/autonomous/run -H "x-autonomous-secret: ..." -d '{...}'`

### Debugging
- **Console logs:** Look for `[Orchestrator]`, `[API/autonomous/run]` prefixes
- **Supabase:** Query `autonomous_leads` table directly to verify data saved
- **Network tab:** Check request/response to `/api/autonomous/run`

---

## Next Steps for Future Development

1. **Admin Dashboard** — Lead approval UI (move from "pending" → "approved" status)
2. **Audit Tool Integration** — API to sync approved leads to main system
3. **Notifications** — Email admin when new qualified leads found
4. **Team Assignment** — Assign approved leads to team members
5. **Performance** — Batch process more channels per run (currently 32 per run)
6. **Reporting** — Analytics dashboard showing discovery trends

---

## Developer Notes

### Why Separate Supabase Project?
- Isolation: Autonomous system doesn't touch Audit Tool data
- Governance: Separate backup/security policies
- Flexibility: Can have different retention periods for lead history

### Why Conservative LLM Qualification?
- False positives (wrong leads) are costly (team time wasted)
- False negatives (missed good leads) are less costly (run discovery again)
- Temperature 0.2 ensures consistent decisions

### Why Save Rejected Leads?
- Transparency: Users can see WHY something was rejected
- Future improvement: Better tuning of qualification criteria
- Debugging: Identify if LLM is too strict/lenient

### Why fail-open Architecture?
- Better UX: 1 enrichment failure doesn't break the run
- Rate limit resilience: If API quota exhausted, keep processing what we can
- Encourages inspection: Users see errors in summary, can take action

---

## Contact & Support

For questions or issues:
- Check `.env.local` is configured correctly
- Review orchestrator logs in console
- Check Supabase table directly to verify data
- Verify Groq and YouTube API keys are active

---

**File created:** 2026-05-23  
**Next recommended action:** Install OmniHub, run a discovery test, verify leads appear in table.
