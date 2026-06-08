import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { listVersions, listCreatorScripts } from '@/app/lib/services/script-service'
import type { VersionSummaryRow } from '@/app/lib/services/script-service'
import { getBuildStatusesForVersions } from '@/app/lib/services/build-operations-service'
import { notFound } from 'next/navigation'
import VersionsHistoryClient from './versions-client'

export default async function ScriptVersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const user = await getCurrentUser()
  const { slug } = await params
  const sp = await searchParams

  if (!user) notFound()

  const page = typeof sp.page === 'string' ? parseInt(sp.page, 10) : 1
  const limit = 10
  const offset = Math.max(0, (isNaN(page) ? 0 : page - 1) * limit)

  const result = await listVersions(user.id, slug, limit, offset)

  if (!result.success) {
    notFound()
  }

  const versions: VersionSummaryRow[] = result.versions
  const total = result.total
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const scriptsResult = await listCreatorScripts(user.id, { limit: 50, offset: 0 })
  const scripts = scriptsResult.success ? scriptsResult.scripts : []
  const buildStatusResult = await getBuildStatusesForVersions(user.id, slug, versions)
  const buildsByVersionId = buildStatusResult.success ? buildStatusResult.buildsByVersionId : {}

  return (
    <VersionsHistoryClient
      slug={slug}
      versions={versions}
      total={total}
      page={page}
      totalPages={totalPages}
      scripts={scripts}
      buildsByVersionId={buildsByVersionId}
    />
  )
}
