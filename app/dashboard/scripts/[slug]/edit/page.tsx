import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getDashboardBuildInfoForScripts } from '@/app/lib/services/dashboard-build-service'
import { getVisibleScript, listCurrentVersionSummariesForScripts } from '@/app/lib/services/script-service'
import { parseUploadedFilename } from '@/app/lib/source-file-metadata'
import { redirect, notFound } from 'next/navigation'
import EditScriptClient from './edit-client'

export default async function EditScriptPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const { slug } = await params

  const result = await getVisibleScript(slug, user.id)

  if (!result.success || !result.script) {
    notFound()
  }

  const [versionsResult, buildsByVersionId] = await Promise.all([
    listCurrentVersionSummariesForScripts(user.id, [result.script]),
    getDashboardBuildInfoForScripts(user.id, [result.script]),
  ])

  const currentVersion = result.script.current_version_id && versionsResult.success
    ? versionsResult.versionsById[result.script.current_version_id] ?? null
    : null

  const buildInfo = result.script.current_version_id
    ? buildsByVersionId[result.script.current_version_id] ?? null
    : null

  return (
    <EditScriptClient
      script={result.script}
      currentVersion={currentVersion}
      buildInfo={buildInfo}
      lastUploadedFilename={parseUploadedFilename(currentVersion?.changelog)}
    />
  )
}
