'use client'

import { useState } from 'react'
import growLogo from '../../public/logo-light.png'
import { createClient } from '../../lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleGoogleLogin() {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch (err) {
      setError('Failed to initiate Google login')
      setLoading(false)
    }
  }

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center px-6 py-12"
      style={{
        background: '#1a1a2e',
        color: '#fff',
      }}
    >
      {/* Background video with gradient fallback */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          background: 'linear-gradient(135deg, #0a0410 0%, #1a0a2e 40%, #16213e 100%)'
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onLoadStart={() => console.log('[Video] Load started')}
          onLoadedData={() => console.log('[Video] Data loaded')}
          onLoadedMetadata={() => console.log('[Video] Metadata loaded')}
          onCanPlay={() => console.log('[Video] Can play')}
          onPlay={() => console.log('[Video] Playing')}
          onError={(e) => {
            const error = (e.target as HTMLVideoElement).error
            console.error('[Video] Error:', error?.code, error?.message)
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 1
          }}
        >
          <source src="/video/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Scrim overlay */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(ellipse 75% 75% at 50% 45%, rgba(8,6,15,.18), rgba(5,4,10,.5)), linear-gradient(180deg, rgba(5,4,10,.22), rgba(5,4,10,.5))',
        }}
      />

      {/* Content wrapper */}
      <div className="relative z-[2] flex flex-col items-center w-full">
        {/* Logo section */}
        <div className="flex flex-col items-center mb-8">
          <div className="inline-flex" style={{ padding: '18px 24px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={growLogo.src}
              alt="GetRichOnWednesday"
              style={{
                height: 'clamp(64px, 20vw, 84px)',
                display: 'block',
                width: 'auto',
              }}
              onError={(e) => {
                console.error('Logo failed to load:', e)
              }}
            />
          </div>
          <p
            className="mt-2.5 text-center uppercase tracking-[.2em]"
            style={{
              color: 'rgba(255,255,255,.55)',
              fontWeight: 600,
              fontSize: '12px',
              lineHeight: 1,
            }}
          >
            Autonomous Lead Searching Platform
          </p>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-[430px]"
          style={{
            marginTop: '34px',
            background: 'rgba(12,9,20,.62)',
            border: '1px solid rgba(255,255,255,.10)',
            borderRadius: 'clamp(18px, 5vw, 22px)',
            padding: 'clamp(26px, 6vw, 34px)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            boxShadow: '0 40px 90px rgba(0,0,0,.6)',
          }}
        >
          <h1
            className="text-center m-0"
            style={{
              color: '#fff',
              fontWeight: 700,
              fontSize: '24px',
              lineHeight: 1.1,
              letterSpacing: '-.01em',
            }}
          >
            Welcome back
          </h1>
          <p
            className="text-center"
            style={{
              margin: '8px 0 0',
              color: 'rgba(255,255,255,.55)',
              fontWeight: 400,
              fontSize: '14px',
              lineHeight: 1.4,
            }}
          >
            Sign in to access your dashboard
          </p>

          <div style={{ marginTop: '26px' }}>
            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-lg font-semibold text-sm transition-all"
              style={{
                background: '#ffffff',
                color: '#15121c',
                border: 0,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,.3)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 30px rgba(0,0,0,.4)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.3)'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {error && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm border mt-4"
                style={{
                  background: 'rgba(255, 107, 107, 0.12)',
                  borderColor: 'rgba(255, 107, 107, 0.3)',
                  color: '#ff6b6b',
                }}
              >
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
