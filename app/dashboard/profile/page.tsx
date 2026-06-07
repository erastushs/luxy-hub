import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { UserCircle } from 'lucide-react'

export default async function ProfilePage() {
  const user = await getCurrentUser()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage your account</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/20 text-red-400">
            <UserCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-medium text-white">
              {user?.profile.display_name ?? 'Creator'}
            </h3>
            <p className="text-sm text-zinc-400">{user?.email}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <span className="text-xs text-zinc-500">Role</span>
            <p className="mt-1 text-sm font-medium capitalize text-white">
              {user?.role ?? '—'}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <span className="text-xs text-zinc-500">Username</span>
            <p className="mt-1 text-sm font-medium text-white">
              {user?.profile.username ?? '—'}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-zinc-600">
          Profile management and settings coming soon.
        </p>
      </div>
    </div>
  )
}
