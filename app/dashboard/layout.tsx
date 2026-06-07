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
      <Sidebar />
      <div className="ml-60">
        <TopNav />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
