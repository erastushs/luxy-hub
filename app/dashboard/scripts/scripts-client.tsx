'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Search, Filter } from 'lucide-react'
import { ScriptTable } from '@/app/dashboard/components/ScriptTable'
import { ScriptCard } from '@/app/dashboard/components/ScriptCard'
import { DeleteDialog } from '@/app/dashboard/components/DeleteDialog'
import { EmptyState } from '@/app/dashboard/components/EmptyState'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import { Pagination } from '@/app/dashboard/components/Pagination'
import { deleteScriptAction } from '@/app/actions/scripts'
import type { DashboardScriptListItem } from '@/app/dashboard/lib/script-list-item'

type ScriptsListClientProps = {
  scripts: DashboardScriptListItem[]
  total: number
  page: number
  totalPages: number
  search: string
  visibility: string
  error: string | null
}

export function ScriptsListClient({
  scripts: initialScripts,
  total,
  page,
  totalPages,
  search,
  visibility,
  error,
}: ScriptsListClientProps) {
  const router = useRouter()
  const [scripts, setScripts] = useState<DashboardScriptListItem[]>(initialScripts)
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; slug: string } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const hasFilters = search || visibility !== 'all'

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        sp.set(key, value)
      }
    }
    router.push(`/dashboard/scripts?${sp.toString()}`)
  }

  function handleSearch(formData: FormData) {
    const q = (formData.get('search') as string) || ''
    navigate({
      search: q || undefined,
      visibility: visibility === 'all' ? undefined : visibility,
      page: '1',
    })
  }

  const handleDelete = useCallback(
    async (slug: string) => {
      const result = await deleteScriptAction(slug)
      if (result.success) {
        toast.success('Script deleted')
        setScripts((prev) => prev.filter((s) => s.slug !== slug))
      } else {
        toast.error(result.message ?? 'Failed to delete script')
      }
      setDeleteTarget(null)
    },
    []
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Scripts</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {total > 0
              ? `${total} script${total !== 1 ? 's' : ''}`
              : 'Manage your scripts'}
          </p>
        </div>

        <Link
          href="/dashboard/scripts/new"
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Script
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action={handleSearch} className="flex-1" role="search">
          <div className="relative">
            <label htmlFor="script-search" className="sr-only">Search scripts</label>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
            <input
              id="script-search"
              ref={searchInputRef}
              name="search"
              defaultValue={search}
              placeholder="Search scripts..."
              className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <label htmlFor="visibility-filter" className="sr-only">Filter by visibility</label>
          <Filter className="h-4 w-4 text-zinc-500" aria-hidden="true" />
          <select
            id="visibility-filter"
            value={visibility}
            onChange={(e) =>
              navigate({
                visibility: e.target.value === 'all' ? undefined : e.target.value,
                search: search || undefined,
                page: '1',
              })
            }
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
          >
            <option value="all">All visibilities</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {scripts.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No scripts match your filters' : 'No scripts yet'}
          description={
            hasFilters
              ? 'Try adjusting your search or visibility filter.'
              : 'Create your first script to get started.'
          }
          action={
            !hasFilters ? (
              <Link
                href="/dashboard/scripts/new"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Script
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <ScriptTable scripts={scripts} onDeleteClick={(slug) => {
              const s = scripts.find((sc) => sc.slug === slug)
              if (s) setDeleteTarget({ name: s.name, slug: s.slug })
            }} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
            {scripts.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                onDelete={(slug) => {
                  setScripts((prev) => prev.filter((s) => s.slug !== slug))
                }}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={(p) =>
                navigate({
                  search: search || undefined,
                  visibility: visibility === 'all' ? undefined : visibility,
                  page: String(p),
                })
              }
            />
          )}
        </>
      )}

      {deleteTarget && (
        <DeleteDialog
          scriptName={deleteTarget.name}
          scriptSlug={deleteTarget.slug}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
