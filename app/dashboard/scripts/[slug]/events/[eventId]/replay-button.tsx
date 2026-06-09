'use client'

import { useState, useTransition } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { replayEventAction } from '@/app/actions/events'

export function ReplayButton({ slug, eventId }: { slug: string; eventId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleClick = () => {
    setResult(null)
    startTransition(async () => {
      const res = await replayEventAction(slug, eventId)
      setResult(res)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-red-800 px-3 py-2 text-sm font-medium transition-colors',
          isPending
            ? 'cursor-not-allowed text-zinc-600 border-zinc-800'
            : 'text-red-400 hover:bg-red-950',
        )}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        Replay Event
      </button>
      {result && (
        <span className={cn('text-sm', result.success ? 'text-emerald-400' : 'text-red-400')}>
          {result.message}
        </span>
      )}
    </div>
  )
}
