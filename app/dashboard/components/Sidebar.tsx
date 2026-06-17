'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/app/lib/utils'
import {
  LayoutDashboard,
  FileCode,
  BarChart3,
  History,
  KeyRound,
  Ticket,
  UserCircle,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import { useState } from 'react'

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  hidden?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Scripts', href: '/dashboard/scripts', icon: FileCode },
  { label: 'Keys', href: '/dashboard/keys', icon: Ticket },
  { label: 'Licenses', href: '/dashboard/licenses', icon: KeyRound, hidden: true },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Versions', href: '/dashboard/versions', icon: History },
  { label: 'Profile', href: '/dashboard/profile', icon: UserCircle },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navContent = (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-zinc-800 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white" aria-hidden="true">
          L
        </div>
        <span className="text-base font-semibold text-white">LuxyHub</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Main navigation">
        {navItems.filter((item) => !item.hidden).map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
                isActive
                  ? 'bg-red-600/10 text-red-400'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800/50 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </>
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-zinc-800 bg-zinc-950 lg:flex">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-zinc-800 bg-zinc-950">
            {navContent}
          </aside>
        </div>
      )}

      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 lg:hidden">
        <Tooltip text="Open Menu" side="bottom">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            aria-label="Open navigation menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white">
              L
            </div>
          </button>
        </Tooltip>
        <span className="text-sm font-medium text-zinc-200">LuxyHub</span>
        <div className="w-8" />
      </div>
    </>
  )
}
