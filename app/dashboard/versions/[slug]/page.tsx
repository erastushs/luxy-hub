import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { listVersions, listCreatorScripts } from '@/app/lib/services/script-service'
import type { VersionRow } from '@/app/lib/services/script-service'
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

  const versions: VersionRow[] = result.versions
  const total = result.total
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const scriptsResult = await listCreatorScripts(user.id, { limit: 50, offset: 0 })
  const scripts = scriptsResult.success ? scriptsResult.scripts : []

  return (
    <VersionsHistoryClient
      slug={slug}
      versions={versions}
      total={total}
      page={page}
      totalPages={totalPages}
      scripts={scripts}
    />
  )
}
