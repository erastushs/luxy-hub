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
    <header className="hidden lg:flex sticky top-0 z-30 h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-xl px-6">
      <nav aria-label="Breadcrumb">
        <span className="text-sm font-medium text-zinc-200">{breadcrumb}</span>
      </nav>
    </header>
  )
}
