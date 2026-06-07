// app/login/page.tsx
// Beautiful login page with Google OAuth integration

import { Metadata } from 'next'
import { LoginForm } from './components/LoginForm'

export const metadata: Metadata = {
  title: 'Login | Autonomous Lead Discovery',
  description: 'Sign in to GROW Autonomous Lead Discovery System',
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const error = searchParams.error as string | undefined
  const redirectTo = (searchParams.redirectTo as string) || '/autonomous'

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg overflow-hidden">
      {/* Background gradient elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated gradient orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-accent-purple opacity-20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-pink opacity-15 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-accent-orange opacity-10 rounded-full blur-3xl animate-float"></div>
      </div>

      {/* Main container */}
      <div className="relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-screen lg:min-h-auto">
          {/* Left side - Visual/Branding (hidden on mobile) */}
          <div className="hidden lg:flex flex-col items-center justify-center px-8 relative">
            {/* Decorative gradient card */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/20 to-accent-pink/10 rounded-r-3xl"></div>

            <div className="relative z-20 text-center space-y-8 max-w-md">
              {/* GROW Logo */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-pink to-accent-purple flex items-center justify-center shadow-lg shadow-accent-pink/30">
                  <span className="text-4xl font-black text-white">G</span>
                </div>
                <div>
                  <h1 className="text-4xl font-black text-gradient-primary mb-2">GROW</h1>
                  <p className="text-sm text-text-secondary">Lead Discovery System</p>
                </div>
              </div>

              {/* Feature highlights */}
              <div className="space-y-6 pt-8">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-pink/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Autonomous Discovery</h3>
                    <p className="text-xs text-text-secondary mt-1">AI-powered YouTube channel finding</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-purple/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Smart Qualification</h3>
                    <p className="text-xs text-text-secondary mt-1">LLM-powered lead scoring</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-orange/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Full Transparency</h3>
                    <p className="text-xs text-text-secondary mt-1">See all decisions and reasoning</p>
                  </div>
                </div>
              </div>

              {/* Footer text */}
              <p className="text-xs text-text-muted pt-8 border-t border-border-subtle">
                Secure admin access only
              </p>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 lg:py-0">
            <div className="w-full max-w-md">
              {/* Mobile logo (shown on mobile, hidden on desktop) */}
              <div className="lg:hidden mb-8 flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-pink to-accent-purple flex items-center justify-center shadow-lg shadow-accent-pink/30">
                  <span className="text-3xl font-black text-white">G</span>
                </div>
                <h1 className="text-2xl font-black text-gradient-primary">GROW</h1>
              </div>

              {/* Glass card container */}
              <div className="card-glass p-8 space-y-6">
                {/* Header */}
                <div>
                  <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome Back</h2>
                  <p className="text-sm text-text-secondary">
                    Sign in to access the Autonomous Lead Discovery System
                  </p>
                </div>

                {/* Error message */}
                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-semibold text-red-400">
                          {error === 'unauthorized'
                            ? 'Unauthorized Access'
                            : error === 'no_code'
                            ? 'Authentication Failed'
                            : error === 'exchange_failed'
                            ? 'Exchange Failed'
                            : 'Authentication Error'}
                        </h3>
                        <p className="text-xs text-red-300/80 mt-1">
                          {error === 'unauthorized'
                            ? 'This Google account does not have access. Please use an authorized account.'
                            : error === 'no_code'
                            ? 'No authorization code was provided.'
                            : error === 'exchange_failed'
                            ? 'Failed to exchange code for session.'
                            : 'An unexpected error occurred during authentication.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Login form */}
                <LoginForm redirectTo={redirectTo} />

                {/* Divider */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border-subtle"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="px-2 bg-dark-bg text-text-muted">Admin Only</span>
                  </div>
                </div>

                {/* Footer text */}
                <p className="text-xs text-text-muted text-center">
                  Authorized administrators only. Unauthorized access attempts are logged.
                </p>
              </div>

              {/* Bottom badge */}
              <div className="mt-6 text-center">
                <p className="text-xs text-text-muted">
                  Secured by{' '}
                  <span className="font-semibold text-text-primary">Supabase</span> +{' '}
                  <span className="font-semibold text-text-primary">Google OAuth</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
