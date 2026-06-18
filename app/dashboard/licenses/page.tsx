import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { listCreatorScripts, type ScriptRow } from '@/app/lib/services/script-service'
import { redirect } from 'next/navigation'
import { LicensesClient } from './licenses-client'

export default async function LicensesPage() {
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  const result = await listCreatorScripts(user.id, { visibility: 'all', limit: 100, offset: 0 })

  const scripts: ScriptRow[] = result.success ? result.scripts : []

  return (
    <LicensesClient
      scripts={scripts.map((script) => ({
        id: script.id,
        slug: script.slug,
        name: script.name,
      }))}
      initialError={result.success ? null : result.message}
    />
  )
}
