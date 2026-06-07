# Audit-Tool System Integration Review

## 🎯 Project Overview
**GROW Audit Tool** is a Next.js 14 application for lead scouting and enrichment from YouTube. It has:
- Authentication system (Supabase Auth)
- YouTube enrichment pipeline (`lib/youtube/orchestrator.ts`)
- Lead management with draft/review/save workflow
- Google Sheets sync capability
- Dark theme design system with gradients

---

## 📊 Database Schema - `leads` Table

### Critical Fields for Autonomous System:
```sql
youtube_channel_id   TEXT      -- Dedup key (unique identifier)
draft               BOOLEAN    -- true until human review, false after save
found_by            TEXT       -- Who discovered it (we set to 'AUTO')
status              TEXT       -- Workflow state (default: 'new')
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

### Enrichment Fields Already Exist:
```sql
subscriber_count      INT
total_views          BIGINT
video_count          INT
last_upload_at       TIMESTAMPTZ
avg_views_last_10    INT
s2v_ratio_pct        NUMERIC
posting_frequency_30d NUMERIC
channel_created_at   TIMESTAMPTZ
email                TEXT        -- From About page scrape
website              TEXT        -- From About page scrape
```

### AI Classification Fields:
```sql
category             TEXT   -- E.g., 'tech', 'business', 'gaming'
content_style        TEXT   -- E.g., 'tutorial', 'review', 'vlog'
monetization         TEXT   -- E.g., 'likely', 'unlikely'
remarks_final        TEXT   -- Final remarks (editable by human)
```

### Fields We Need to Add (for autonomous qualification tracking):
```sql
auto_qualified_reason        TEXT     -- LLM's qualification reason
auto_category                TEXT     -- LLM's category classification
auto_content_style           TEXT     -- LLM's content style classification
auto_monetization_likelihood TEXT     -- LLM's monetization assessment
discovered_from_query        TEXT     -- Which search query found this
campaign_target_market       TEXT     -- Target market snapshot
campaign_product_description TEXT     -- Product description snapshot
```

---

## 🔗 YouTube Enrichment Pipeline

### Function: `fetchAllYouTubeData(youtubeUrl: string)`
**Location**: `lib/youtube/orchestrator.ts`

**Returns**: `YouTubeEnrichmentResult`

### Field Mapping (IMPORTANT - Use These Exact Names):
```typescript
interface YouTubeEnrichmentResult {
  channelId: string
  handle: string | null              // e.g. '@RyanTolmia'
  title: string                       // Channel title (NOT channelTitle)
  description: string
  channelCreatedAt: Date
  subscriberCount: number
  totalViews: number
  videoCount: number
  lastUploadAt: Date | null           // NOT lastUploadDate
  avgViewsLast10: number | null
  s2vRatioPct: number | null
  postingFrequency30d: number
  recentVideos: VideoData[]           // Array of videos with stats
  email: string | null
  website: string | null
  socialLinks: Array<{ platform: string; url: string }>
  thumbnailUrl: string | null
  rawApiResponses: { channel, videoIds, videoStats }
}

interface VideoData {
  videoId: string
  title: string
  publishedAt: Date
  viewCount: number
  likeCount: number
  commentCount: number
  durationSec: number
  descriptionSnippet: string
}
```

**How to Call**:
```typescript
import { fetchAllYouTubeData } from '@/lib/youtube/orchestrator'

const enrichment = await fetchAllYouTubeData('https://www.youtube.com/channel/UC...')
// Or: https://www.youtube.com/@handle
// Or: legacy youtube.com/user/username URLs
```

---

## 🏗️ App Structure

### Authenticated Routes (Protected by Auth)
```
app/(authenticated)/
  ├── layout.tsx                    -- Auth guard, NavbarWrapper
  ├── leads/
  │   ├── page.tsx                  -- List all non-draft leads
  │   └── [id]/
  │       ├── page.tsx              -- Lead details
  │       ├── review/page.tsx        -- Full review form (where humans finalize)
  │       └── edit/page.tsx          -- Edit lead
  ├── enrich/                        -- Manual enrichment flow
  ├── admin/                         -- Admin panel
  └── (we will add autonomous/)      -- New autonomous dashboard
```

### Key Components
- **NavbarWrapper**: Main navigation component
- **ReviewForm**: The lead review/editing form
- **LeadsTable**: Table of leads with filters
- **PageTransition**: Page animation wrapper

### How Auth Works
```typescript
// In server components:
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
```

---

## 🎨 Design System (CSS Custom Properties)

### Color Variables Used
```css
--text-primary: #ffffff
--text-secondary: #b0b0c0
--text-muted: #808090
--bg-page: #0f0f23
--bg-surface: #1a1a2e
--color-border: #2a2a4e
--gradient-primary: linear-gradient(90deg, #ff1493, #9c27b0)
--gradient-secondary: linear-gradient(90deg, #ff8c00, #ff6b6b)
--gradient-tertiary: linear-gradient(90deg, #00d9ff, #00e5cc)
```

### How to Style Components
- Existing components use inline CSS with CSS variables
- Use `className="max-w-7xl mx-auto px-6 py-8"` pattern
- Dark theme is primary, no light mode needed
- Reuse existing globals.css classes

---

## 🔄 Lead Workflow

### Current Flow:
```
1. User inputs YouTube URL (manual)
   ↓
2. enrichment/page.tsx → Calls fetchAllYouTubeData()
   ↓
3. Lead saved to Supabase with draft=true
   ↓
4. User reviews at /leads/[id]/review
   ↓
5. Human sets G-Factor, edits remarks, confirms
   ↓
6. draft → false, sheets_synced → true
   ↓
7. Cron job syncs to Google Sheets
```

### Autonomous Flow (NEW):
```
1. User defines Campaign on /autonomous/page.tsx
   ↓
2. Clicks "Start Scouting Run"
   ↓
3. POST /api/autonomous/run → orchestrator.runAutonomousScouting()
   ↓
4. For each discovered + enriched channel:
   - qualifyChannel() → LLM decision
   - IF qualified: saveQualifiedLead() → Supabase (draft=true)
   - logDecision() → OmniHub memory
   ↓
5. Dashboard shows summary
   ↓
6. User goes to /leads to review draft=true autonomous leads
   ↓
7. Same ReviewForm is reused (no changes needed!)
```

---

## ✅ Key Integration Points

### 1. Field Name Mapping (CRITICAL)
**In orchestrator.ts mapEnrichmentToSnapshot():**
- `YouTubeEnrichmentResult.title` → `ChannelSnapshot.channelTitle` ✅
- `YouTubeEnrichmentResult.lastUploadAt` → `ChannelSnapshot.lastUploadDate` (or keep lastUploadAt) ✅
- `YouTubeEnrichmentResult.recentVideos` → Extract titles, views, likes, comments ✅

### 2. Lead Deduplication
- Gate 1: `WHERE youtube_channel_id = ?` (Supabase)
- Gate 2: OmniHub memory check (before expensive enrichment)
- Both gates are already in orchestrator.ts ✅

### 3. Draft Lead Review
- Autonomous leads land in Supabase with `draft=true`
- They appear in `/leads/[id]/review` page
- Same ReviewForm component handles both manual + autonomous leads ✅
- No UI changes needed in existing /leads flow

### 4. Email Notifications
- After run completes, if qualified leads > 0:
  - Build email with RunSummary
  - Use Resend API to send to NOTIFICATION_EMAIL_RECIPIENTS
  - Email includes link to /leads or /autonomous dashboard

---

## 📋 Schema Migration Needed

```sql
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS auto_qualified_reason TEXT,
  ADD COLUMN IF NOT EXISTS auto_category TEXT,
  ADD COLUMN IF NOT EXISTS auto_content_style TEXT,
  ADD COLUMN IF NOT EXISTS auto_monetization_likelihood TEXT,
  ADD COLUMN IF NOT EXISTS discovered_from_query TEXT,
  ADD COLUMN IF NOT EXISTS campaign_target_market TEXT,
  ADD COLUMN IF NOT EXISTS campaign_product_description TEXT;
```

---

## 🚀 Ready to Build

### What We'll Adjust:
1. ✅ orchestrator.ts mapEnrichmentToSnapshot() → Fix field names
2. ✅ orchestrator.ts saveQualifiedLead() → Use new columns
3. ✅ Add Supabase migration
4. ✅ Email notification in orchestrator

### What We DON'T Change:
- ❌ lib/youtube/orchestrator.ts (reuse as-is)
- ❌ ReviewForm component (reuse for autonomous leads)
- ❌ leads/page.tsx (shows all non-draft leads)
- ❌ Design system / CSS (reuse existing)
- ❌ Auth system (already protected)

---

## Summary for Implementation

| Aspect | Status | Notes |
|--------|--------|-------|
| YouTube Enrichment | ✅ Ready | Just call fetchAllYouTubeData() |
| Database Schema | 🟡 Need Migration | Add 7 columns for tracking |
| Deduplication Logic | ✅ Ready | Already in orchestrator |
| Lead Review UI | ✅ Ready | ReviewForm works for autonomous leads |
| Navigation | 🟡 Need Nav Update | Add /autonomous link to NavbarWrapper |
| Email Notifications | 🟡 To Build | Resend integration + template |
| Design System | ✅ Ready | CSS variables already exist |

---

## ⚡ Next Steps

1. **Supabase Migration** → Add the 7 new columns
2. **Module 02-06** → Build autonomous/* modules (no changes needed to existing code)
3. **Module 07** → API route (uses orchestrator unchanged)
4. **Module 08** → Dashboard UI (uses existing NavbarWrapper, design system)
5. **Email Integration** → Add Resend notification after run completes
6. **NavbarWrapper** → Add /autonomous link to sidebar

All modules can be built in isolation and integrated seamlessly!
