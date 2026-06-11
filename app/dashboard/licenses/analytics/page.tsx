import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { listCreatorScripts, type ScriptRow } from '@/app/lib/services/script-service'
import { LicenseAnalyticsClient } from './license-analytics-client'

export default async function LicenseAnalyticsPage() {
  const user = await getCurrentUser()
  const result = await listCreatorScripts(user!.id, { visibility: 'all', limit: 100, offset: 0 })

  const scripts: ScriptRow[] = result.success ? result.scripts : []

  return (
    <LicenseAnalyticsClient
      scripts={scripts.map((script) => ({
        id: script.id,
        slug: script.slug,
        name: script.name,
      }))}
      initialError={result.success ? null : result.message}
    />
  )
}
