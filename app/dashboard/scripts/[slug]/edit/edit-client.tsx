'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { updateScriptAction } from '@/app/actions/scripts'
import type { ScriptRow } from '@/app/lib/services/script-service'

export default function EditScriptClient({ script }: { script: ScriptRow }) {
  const updateWithSlug = updateScriptAction.bind(null, script.slug)
  const [state, formAction, isPending] = useActionState(updateWithSlug, { success: false })

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
          <h1 className="text-2xl font-bold text-white">Edit Script</h1>
          <p className="mt-1 text-sm text-zinc-400">/{script.slug}</p>
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
            defaultValue={script.name}
            maxLength={100}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
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
            defaultValue={script.description ?? ''}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="Optional description"
          />
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-zinc-300">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={script.visibility}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3">
          <p className="text-xs text-zinc-500">
            Content editing and version management are available in the version history section.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
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
