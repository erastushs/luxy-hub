import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { listCreatorScripts, type ScriptRow } from '@/app/lib/services/script-service'
import { ScriptsListClient } from './scripts-client'

export default async function ScriptsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const user = await getCurrentUser()

  const params = await searchParams
  const search = typeof params.search === 'string' ? params.search : ''
  const visibility = typeof params.visibility === 'string' ? params.visibility : 'all'
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1
  const limit = 12

  const offset = Math.max(0, (isNaN(page) ? 0 : page - 1) * limit)

  const result = await listCreatorScripts(user!.id, {
    visibility: visibility === 'all' ? undefined : visibility,
    search: search || undefined,
    limit,
    offset,
  })

  const scripts: ScriptRow[] = result.success ? result.scripts : []
  const total = result.success ? result.total : 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const error = result.success ? null : result.message

  return (
    <ScriptsListClient
      scripts={scripts}
      total={total}
      page={page}
      totalPages={totalPages}
      search={search}
      visibility={visibility}
      error={error}
    />
  )
}
