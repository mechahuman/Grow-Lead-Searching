// app/api/auth/revoke/route.ts
// Revoke an access token

import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 })
    }

    // Call Supabase to revoke the token
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL}/auth/v1/logout`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY || '',
        },
      }
    )

    if (!response.ok) {
      console.error('[Auth/Revoke] Failed to revoke token:', response.statusText)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Auth/Revoke] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
