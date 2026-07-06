import type { Metadata } from 'next'
import './globals.css'
import { PageTransition } from '@/components/PageTransition'
import { AuthProvider } from '@/lib/auth/context'

export const metadata: Metadata = {
  title: 'GROW Autonomous Lead Searching',
  description: 'AI-powered autonomous YouTube channel discovery and lead qualification.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#a855f7" />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <AuthProvider>
          <PageTransition>{children}</PageTransition>
        </AuthProvider>
      </body>
    </html>
  )
}
