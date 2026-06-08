'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createScriptAction } from '@/app/actions/scripts'

export default function NewScriptPage() {
  const [state, formAction, isPending] = useActionState(createScriptAction, { success: false })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/scripts"
          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Script</h1>
          <p className="mt-1 text-sm text-zinc-400">Create a new script</p>
        </div>
      </div>

      <form action={formAction} className="space-y-6">
        {state?.message && !state.success && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
            {state.message}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-300">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="My Script"
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-zinc-300">
            Slug
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Lowercase letters, numbers, and hyphens. 3-64 characters.
          </p>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            maxLength={64}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="my-script"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-300">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="Optional description"
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-zinc-300">
            Content
          </label>
          <p className="mt-1 text-xs text-zinc-500">Script body. Max 62 KB.</p>
          <textarea
            id="content"
            name="content"
            rows={8}
            required
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="print('hello')"
          />
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-zinc-300">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="private"
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create Script'}
          </button>
          <Link
            href="/dashboard/scripts"
            className="rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
