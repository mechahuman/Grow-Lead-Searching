# Autonomous Lead Searching System (Future Building)

This document outlines the architecture and implementation steps for building an Autonomous Lead Searching System for YouTube, inspired by tools like OpenOutreach and data logging CLIs. Feed this into a coding agent when you are ready to build the next phase of the product.

## 1. Conceptual Overview

The goal is to shift from a *manual input* system to an *autonomous discovery* system. 
Instead of the user providing a specific YouTube Channel ID, the user provides:
1. **Target Market / Persona** (e.g., "Small tech reviewers with 10k-50k subs")
2. **Product Description** (e.g., "A video editing AI software")

The AI will then autonomously discover channels, evaluate them against the criteria, and feed the qualified ones into our existing Audit and CRM system.

## 2. System Architecture

### Component A: The Discovery Engine
- **Query Generation**: Use an LLM to translate the user's "Target Market" into actionable YouTube Search Queries (e.g., "latest tech review 2024").
- **Search Execution**: Intercept the YouTube Data API (`search` endpoint) to pull a list of channels based on those queries.

### Component B: The ML Qualification Pipeline (OpenOutreach Approach)
- **Initial Scraping**: For each discovered channel, pull their basic stats (subscribers, recent video views, channel description).
- **LLM Evaluator**: Feed the channel stats and description to an LLM. Ask it: "Does this channel fit the target persona?". 
- **Bayesian/Smart Loop**: Over time, the system should learn what types of channels the user actually contacts vs rejects, optimizing the search queries automatically.

### Component C: Automated Data Logging (OmniHub/CLI Concept)
- Implement a background daemon or a CRON job (e.g., Vercel Cron or a Node.js worker) that runs these searches autonomously in the background.
- **Data Logging**: Every discovered lead, whether qualified or rejected, is logged. Use structured logging to track the system's efficiency (e.g., "100 channels found -> 15 qualified -> 15 added to CRM").

## 3. Step-by-Step Implementation Guide

### Phase 1: Search Automation
- Create a new backend service `lib/autonomous/search.ts`.
- Implement a function `generateSearchQueries(targetMarket)` using the LLM.
- Implement `executeYouTubeSearch(queries)` to return raw Channel IDs.

### Phase 2: Autonomous Qualification
- Create `lib/autonomous/qualifier.ts`.
- Fetch channel metadata for the discovered Channel IDs.
- Create an LLM prompt that takes the `channel_metadata` and the user's `product_description`/`criteria` and returns a boolean `is_qualified` along with a `reason`.

### Phase 3: CRM Integration
- For every channel where `is_qualified == true`, automatically pass the Channel ID to our existing enrichment API pipeline.
- Automatically save the enriched lead to the Supabase database with a status of `AUTONOMOUSLY_SOURCED` or `PENDING_REVIEW`.

### Phase 4: The Dashboard & Logging
- Build a new UI page: `app/(authenticated)/autonomous/page.tsx`.
- Create a dashboard where the user can:
  1. Define their Campaign (Target Market & Product).
  2. Start/Stop the autonomous worker.
  3. View the Data Logs (How many channels scanned today, how many added).
- This fulfills the "data logging" requirement by giving the user a transparent view into the autonomous agent's activity.
