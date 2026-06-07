'use client'

import { usePathname } from 'next/navigation'

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/scripts': 'Scripts',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/versions': 'Versions',
  '/dashboard/profile': 'Profile',
}

export function TopNav() {
  const pathname = usePathname()

  const breadcrumb = breadcrumbMap[pathname] ?? 'Dashboard'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-xl px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-200">{breadcrumb}</span>
      </div>
    </header>
  )
}
