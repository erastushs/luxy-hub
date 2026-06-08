'use client'

import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'

type DeleteDialogProps = {
  scriptName: string
  scriptSlug: string
  onConfirm: (slug: string) => Promise<void>
  onCancel: () => void
}

export function DeleteDialog({ scriptName, scriptSlug, onConfirm, onCancel }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    await onConfirm(scriptSlug)
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Delete ${scriptName}`}>
      <div className="fixed inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-600/10" aria-hidden="true">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Delete Script</h3>
            <p className="text-xs text-zinc-400">
              Are you sure you want to delete &ldquo;{scriptName}&rdquo;? This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
