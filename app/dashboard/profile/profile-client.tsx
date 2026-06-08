'use client'

import { useState, useActionState } from 'react'
import { UserCircle, Pencil, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { updateProfileAction } from '@/app/actions/profile'
import { logout } from '@/app/actions/auth'
import { CopyButton } from '@/app/dashboard/components/CopyButton'
import type { AuthenticatedUser } from '@/app/lib/auth/session-auth'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

type ProfileFieldProps = {
  label: string
  children: React.ReactNode
  action?: React.ReactNode
}

function ProfileField({ label, children, action }: ProfileFieldProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        {action}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

export function ProfileClient({ user }: { user: AuthenticatedUser }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, isPending] = useActionState(updateProfileAction, {
    success: false,
  })

  if (state.success) {
    if (editing) {
      setEditing(false)
      toast.success(state.message ?? 'Profile updated')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage your account</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600/20 text-red-400">
            <UserCircle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {user.profile.display_name}
            </h3>
            <p className="text-sm text-zinc-400">{user.email}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProfileField label="Display Name">
            <p className="text-sm font-medium text-white">
              {user.profile.display_name}
            </p>
          </ProfileField>

          <ProfileField label="Username">
            <p className="text-sm font-medium text-white">
              {user.profile.username ?? (
                <span className="text-zinc-600">Not set</span>
              )}
            </p>
          </ProfileField>

          <ProfileField label="Role">
            <p className="text-sm font-medium capitalize text-white">
              {user.role}
            </p>
          </ProfileField>

          <ProfileField label="Email">
            <p className="truncate text-sm text-white">{user.email}</p>
          </ProfileField>

          <ProfileField
            label="User ID"
            action={<CopyButton value={user.id} />}
          >
            <p className="truncate font-mono text-xs text-zinc-400">
              {user.id}
            </p>
          </ProfileField>

          <ProfileField label="Member since">
            <p className="text-sm text-white">
              {formatDate(user.profile.created_at)}
            </p>
          </ProfileField>
        </div>

        <div className="mt-6 border-t border-zinc-800 pt-5">
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/30 px-3.5 py-2 text-sm text-red-400 transition hover:bg-red-950/60"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </div>

      {editing && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">Edit Profile</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Update your display name and username.
          </p>

          <form action={formAction} className="mt-6 space-y-5">
            {state.message && !state.success && (
              <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
                {state.message}
              </div>
            )}

            <div>
              <label
                htmlFor="display_name"
                className="block text-sm font-medium text-zinc-300"
              >
                Display Name
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                required
                defaultValue={user.profile.display_name}
                maxLength={80}
                className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>

            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-zinc-300"
              >
                Username
              </label>
              <p className="mt-1 text-xs text-zinc-500">
                3-30 characters. Lowercase letters, digits, and hyphens.
                Leave empty to clear.
              </p>
              <input
                id="username"
                name="username"
                type="text"
                defaultValue={user.profile.username ?? ''}
                maxLength={30}
                pattern="^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$"
                className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                placeholder="my-username"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={isPending}
                className="rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
