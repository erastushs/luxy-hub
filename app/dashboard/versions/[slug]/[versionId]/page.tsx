import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getVersionDetail } from '@/app/lib/services/script-service'
import { getBuildStatusesForVersions } from '@/app/lib/services/build-operations-service'
import { VersionDetail } from '@/app/dashboard/components/VersionDetail'
import { notFound } from 'next/navigation'

export default async function VersionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; versionId: string }>
}) {
  const user = await getCurrentUser()
  const { slug, versionId } = await params

  if (!user) notFound()

  const result = await getVersionDetail(user.id, slug, versionId)

  if (!result.success) {
    notFound()
  }

  const buildStatusResult = await getBuildStatusesForVersions(user.id, slug, [result.version])
  const build = buildStatusResult.success
    ? buildStatusResult.buildsByVersionId[result.version.id] ?? null
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <VersionDetail version={result.version} scriptSlug={slug} build={build} />
    </div>
  )
}
