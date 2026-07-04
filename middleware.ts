// middleware.ts
// Protect authenticated routes and redirect to login if not authenticated

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // List of public routes that don't require authentication
  const publicRoutes = ['/login', '/auth', '/api/auth']

  // Check if the current route is public
  const pathname = request.nextUrl.pathname
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // For protected routes, check if user is authenticated
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If no session exists, redirect to login
  if (!session) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes (except auth)
    '/((?!_next/static|_next/image|favicon.ico|favicon.png|apple-touch-icon.png|manifest.json).*)',
  ],
}
