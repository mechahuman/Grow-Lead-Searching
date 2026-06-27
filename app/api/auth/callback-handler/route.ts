// app/api/auth/callback-handler/route.ts
// Server-side handler for OAuth callback - properly sets session in cookies

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { accessToken, refreshToken } = await request.json()

    if (!accessToken) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 })
    }

    const cookieStore = cookies()

    // Create Supabase client with cookie support
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch (error) {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    )

    // Set the session server-side so cookies are properly set
    const { error: setError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    })

    if (setError) {
      console.error('[API/Callback] setSession error:', setError)
      return NextResponse.json({ error: setError.message }, { status: 400 })
    }

    // Get the user to verify email
    let user = null
    try {
      const { data: { user: userData }, error: userError } = await supabase.auth.getUser()

      if (userError) {
        // If we get a refresh token error, it's likely already valid but was consumed
        if (userError.message?.includes('refresh_token_already_used')) {
          console.warn('[API/Callback] Token already used (expected in some cases), proceeding anyway')
          // Extract user from JWT if possible
          const decoded = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString())
          user = {
            id: decoded.sub,
            email: decoded.email,
          }
        } else {
          console.error('[API/Callback] getUser error:', userError)
          return NextResponse.json({ error: 'Failed to get user' }, { status: 400 })
        }
      } else if (userData?.email) {
        user = userData
      }
    } catch (e) {
      console.error('[API/Callback] Error getting user:', e)
      // Try to extract from token
      try {
        const decoded = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString())
        user = {
          id: decoded.sub,
          email: decoded.email,
        }
      } catch {
        return NextResponse.json({ error: 'Failed to decode user information' }, { status: 400 })
      }
    }

    if (!user?.email) {
      return NextResponse.json({ error: 'No email found in token' }, { status: 400 })
    }

    // Check email authorization
    const authorizedEmail = process.env.NEXT_PUBLIC_AUTHORIZED_ADMIN_EMAIL
    if (user.email !== authorizedEmail) {
      console.warn(`[API/Callback] Unauthorized: ${user.email}`)

      // Sign out unauthorized user (don't error if this fails due to token issues)
      try {
        await supabase.auth.signOut()
      } catch (e) {
        console.warn('[API/Callback] Error signing out unauthorized user:', e)
      }

      return NextResponse.json(
        { error: 'unauthorized', message: 'This email is not authorized.' },
        { status: 403 }
      )
    }

    console.log(`[API/Callback] User authorized: ${user.email}`)

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        id: user.id,
      },
    })
  } catch (error) {
    console.error('[API/Callback] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
