import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getDashboardBuildInfoForScripts } from '@/app/lib/services/dashboard-build-service'
import {
  listCreatorScripts,
  listCurrentVersionSummariesForScripts,
  type ScriptRow,
} from '@/app/lib/services/script-service'
import { ScriptsListClient } from './scripts-client'
import { redirect } from 'next/navigation'

export default async function ScriptsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  const params = await searchParams
  const search = typeof params.search === 'string' ? params.search : ''
  const visibility = typeof params.visibility === 'string' ? params.visibility : 'all'
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1
  const limit = 12

  const offset = Math.max(0, (isNaN(page) ? 0 : page - 1) * limit)

  const result = await listCreatorScripts(user.id, {
    visibility: visibility === 'all' ? undefined : visibility,
    search: search || undefined,
    limit,
    offset,
  })

  const scripts: ScriptRow[] = result.success ? result.scripts : []
  const total = result.success ? result.total : 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const error = result.success ? null : result.message
  const [versionsResult, buildsByVersionId] = await Promise.all([
    listCurrentVersionSummariesForScripts(user.id, scripts),
    getDashboardBuildInfoForScripts(user.id, scripts),
  ])

  const versionsById = versionsResult.success ? versionsResult.versionsById : {}
  const scriptItems = scripts.map((script) => {
    const currentVersion = script.current_version_id
      ? versionsById[script.current_version_id] ?? null
      : null
    const buildInfo = script.current_version_id
      ? buildsByVersionId[script.current_version_id] ?? null
      : null

    return {
      ...script,
      currentVersion,
      buildInfo,
    }
  })

  return (
    <ScriptsListClient
      scripts={scriptItems}
      total={total}
      page={page}
      totalPages={totalPages}
      search={search}
      visibility={visibility}
      error={error}
    />
  )
}
