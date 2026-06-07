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
  maxQualifiedLeads?: number
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
