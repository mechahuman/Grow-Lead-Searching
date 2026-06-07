// app/auth/callback/page.tsx
// OAuth callback handler - client component to process implicit flow

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CallbackPage() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract token from URL hash
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (!accessToken) {
          const error = params.get('error')
          if (error) {
            setError(error)
            router.push(`/login?error=${encodeURIComponent(error)}`)
          } else {
            setError('no_token')
            router.push('/login?error=no_token')
          }
          return
        }

        console.log('[Callback] Token received from OAuth, sending to server...')

        // Send tokens to server-side handler for proper session setup
        const response = await fetch('/api/auth/callback-handler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken,
            refreshToken,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          console.error('[Callback] Handler error:', result.error)
          setError(result.error)
          router.push(`/login?error=${encodeURIComponent(result.error)}`)
          return
        }

        console.log('[Callback] Session established:', result.user?.email)
        setIsProcessing(false)

        // Small delay to ensure cookies are set
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Redirect to autonomous dashboard
        router.push('/autonomous')
      } catch (err) {
        console.error('[Callback] Unexpected error:', err)
        setError('callback_error')
        router.push('/login?error=callback_error')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="text-center space-y-4">
        {isProcessing && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 border-4 border-accent-purple/20 border-t-accent-purple rounded-full animate-spin"></div>
            </div>
            <p className="text-text-primary font-semibold">Completing sign in...</p>
            <p className="text-text-secondary text-sm">Please wait while we authenticate you.</p>
          </>
        )}

        {error && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <p className="text-text-primary font-semibold">Authentication Error</p>
            <p className="text-text-secondary text-sm">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  )
}
