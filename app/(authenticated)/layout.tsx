// app/(authenticated)/layout.tsx
// Layout for authenticated pages with header and user menu

import { Header } from './components/Header'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      {children}
    </>
  )
}
