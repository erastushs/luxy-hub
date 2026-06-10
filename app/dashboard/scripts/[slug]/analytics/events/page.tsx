import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getEventAnalytics } from '@/app/lib/services/event-analytics-service'
import { ErrorBanner } from '@/app/dashboard/components/ErrorBanner'
import { EventAnalyticsClient } from './events-analytics-client'

export default async function EventAnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { slug } = await params

  const result = await getEventAnalytics(slug, user.id)

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
            <h1 className="text-xl font-semibold text-zinc-100">Event Analytics</h1>
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
          <h1 className="text-xl font-semibold text-zinc-100">Event Analytics</h1>
        </div>
      </div>

      <EventAnalyticsClient analytics={result.analytics} />
    </div>
  )
}
