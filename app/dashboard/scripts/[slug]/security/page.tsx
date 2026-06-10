import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getSecurityDashboard } from '@/app/lib/services/security-monitoring-service'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import { SecurityClient } from './security-client'

export default async function ScriptSecurityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { slug } = await params
  const sp = await searchParams
  const requestedPage = typeof sp.page === 'string' ? parseInt(sp.page, 10) : 1
  const page = Math.max(1, isNaN(requestedPage) ? 1 : requestedPage)
  const pageSize = 10

  const result = await getSecurityDashboard(slug, user.id, page, pageSize)

  if (!result.success) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={`/dashboard/scripts/${slug}/edit`}
              className="mb-1 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Back to script
            </Link>
            <h1 className="text-xl font-semibold text-zinc-100">Security</h1>
          </div>
        </div>
        <ErrorBanner message={result.message} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/dashboard/scripts/${slug}/edit`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Back to script
          </Link>
          <h1 className="text-xl font-semibold text-zinc-100">Security</h1>
        </div>
      </div>

      <SecurityClient slug={slug} dashboard={result.dashboard} />
    </div>
  )
}
