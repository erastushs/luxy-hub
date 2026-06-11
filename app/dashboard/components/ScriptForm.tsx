'use client'

import { useState, type FormEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { MAX_SCRIPT_SIZE_DISPLAY } from '@/app/lib/constants/size-limits'

type ScriptFormData = {
  name: string
  slug: string
  description: string
  visibility: string
  content: string
}

type ScriptFormProps = {
  initial?: Partial<ScriptFormData>
  onSubmit: (data: ScriptFormData) => Promise<void>
  submitLabel: string
  isPending?: boolean
  error?: string | null
  hideContent?: boolean
  hideSlug?: boolean
}

export function ScriptForm({
  initial,
  onSubmit,
  submitLabel,
  isPending = false,
  error = null,
  hideContent = false,
  hideSlug = false,
}: ScriptFormProps) {
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)

    const formData = new FormData(e.currentTarget)
    const data: ScriptFormData = {
      name: (formData.get('name') as string) || '',
      slug: (formData.get('slug') as string) || '',
      description: (formData.get('description') as string) || '',
      visibility: (formData.get('visibility') as string) || 'private',
      content: (formData.get('content') as string) || '',
    }

    if (!data.name.trim()) {
      setFormError('Name is required')
      return
    }

    if (!hideSlug && !data.slug.trim()) {
      setFormError('Slug is required')
      return
    }

    if (!hideContent && !data.content.trim()) {
      setFormError('Content is required')
      return
    }

    await onSubmit(data)
  }

  const displayError = formError || error

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {displayError && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {displayError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-zinc-300">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={initial?.name ?? ''}
            maxLength={100}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="My Script"
          />
        </div>
      </div>

      {!hideSlug && (
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-zinc-300">
            Slug
          </label>
          <p className="mt-1 text-xs text-zinc-500">Lowercase letters, numbers, and hyphens. 3-64 characters.</p>
          <div className="mt-2 flex gap-2 rounded-lg border border-amber-900/50 bg-amber-950/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <p>
              Changing the slug will change your loader URL and may break existing users.
            </p>
          </div>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            defaultValue={initial?.slug ?? ''}
            maxLength={64}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="my-script"
          />
        </div>
      )}

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-zinc-300">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ''}
          className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
          placeholder="Optional description"
        />
      </div>

      {!hideContent && (
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-zinc-300">
            Content
          </label>
          <p className="mt-1 text-xs text-zinc-500">Script body. Max {MAX_SCRIPT_SIZE_DISPLAY}.</p>
          <textarea
            id="content"
            name="content"
            rows={8}
            defaultValue={initial?.content ?? ''}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            placeholder="print('hello')"
          />
        </div>
      )}

      <div>
        <label htmlFor="visibility" className="block text-sm font-medium text-zinc-300">
          Visibility
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={initial?.visibility ?? 'private'}
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
          {isPending ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
