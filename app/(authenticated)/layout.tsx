import { Header } from './components/Header'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-page min-h-screen">
      <Header />
      {/* Centralized page content wrapper matching the Audit-Tool's layout */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
