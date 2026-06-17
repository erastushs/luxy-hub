import { KeysClient } from './keys-client'
import { listDashboardKeys, type DashboardKey, type KeySummary } from '@/app/lib/services/key-service'

export default async function KeysPage() {
  let initialKeys: DashboardKey[] = []
  let initialSummary: KeySummary = { total: 0, active: 0, expired: 0, disabled: 0 }
  let initialError: string | null = null

  try {
    const result = await listDashboardKeys()
    initialKeys = result.keys
    initialSummary = result.summary
  } catch {
    initialError = 'Failed to load keys'
  }

  return <KeysClient initialKeys={initialKeys} initialSummary={initialSummary} initialError={initialError} />
}
