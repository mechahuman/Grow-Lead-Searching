'use client'

import { useEffect, useState } from 'react'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [])

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.45s ease-out',
      }}
    >
      {children}
    </div>
  )
}
