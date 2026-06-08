'use client'

import { useActionState } from 'react'
import { Hammer } from 'lucide-react'
import { rebuildLatestBuildAction } from '@/app/actions/builds'

type RebuildButtonProps = {
  slug: string
}

export function RebuildButton({ slug }: RebuildButtonProps) {
  const rebuildWithSlug = rebuildLatestBuildAction.bind(null, slug)
  const [state, action, isPending] = useActionState(rebuildWithSlug, { success: false })

  return (
    <div className="space-y-2">
      <form action={action}>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-red-700/50 bg-red-600/10 px-3 py-2 text-sm font-semibold text-red-300 transition hover:border-red-600 hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Rebuild latest version"
          title="Rebuild latest version"
        >
          <Hammer className="h-4 w-4" aria-hidden="true" />
          {isPending ? 'Rebuilding...' : 'Rebuild'}
        </button>
      </form>
      {state?.message && !state.success && (
        <p className="text-xs text-red-400">{state.message}</p>
      )}
    </div>
  )
}
