import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { Sidebar } from '@/app/dashboard/components/Sidebar'
import { TopNav } from '@/app/dashboard/components/TopNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-red-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="lg:ml-60 pt-14 lg:pt-0">
        <TopNav />
        <main id="main-content" className="p-4 sm:p-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
