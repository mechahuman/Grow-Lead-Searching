// app/api/autonomous/delete-lead/route.ts
// POST endpoint that deletes a discovered lead from the database.

import { NextRequest, NextResponse } from 'next/server'
import { getAutonomousSupabaseAdmin } from '@/lib/autonomous/supabase-client'

interface DeleteRequest {
  leadId: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[API/autonomous/delete-lead] POST received')

  try {
    const body = (await request.json()) as DeleteRequest

    if (!body.leadId || typeof body.leadId !== 'string') {
      return NextResponse.json(
        { error: 'leadId is required and must be a string' },
        { status: 400 }
      )
    }

    const supabase = getAutonomousSupabaseAdmin()

    // Delete the lead from the database
    const { error } = await supabase
      .from('autonomous_leads')
      .delete()
      .eq('id', body.leadId)

    if (error) {
      console.error('[API/autonomous/delete-lead] Supabase error:', error.message)
      return NextResponse.json(
        { error: `Failed to delete lead: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`[API/autonomous/delete-lead] Successfully deleted lead: ${body.leadId}`)

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully',
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[API/autonomous/delete-lead] Error:', detail)

    return NextResponse.json(
      {
        error: 'Failed to delete lead',
        detail,
      },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 })
}
