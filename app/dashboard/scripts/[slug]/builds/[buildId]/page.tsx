import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getBuildDetails } from '@/app/lib/services/build-operations-service'
import { BuildStatusBadge } from '@/app/dashboard/components/BuildStatusBadge'
import { RebuildButton } from '@/app/dashboard/components/RebuildButton'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import { formatDateTime } from '@/app/dashboard/lib/format-date'

function dateOrDash(value: string | null): string {
  return value ? formatDateTime(value) : '—'
}

function stringOrDash(value: string | null): string {
  return value && value.length > 0 ? value : '—'
}

export default async function BuildDetailPage({
  params,
}: {
  params: Promise<{ slug: string; buildId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { slug, buildId } = await params
  const result = await getBuildDetails(user.id, slug, buildId)
  if (!result.success) {
    notFound()
  }

  const metadataEntries = Object.entries(result.build.metadata)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Tooltip text="Back to Builds">
            <Link
              href={`/dashboard/scripts/${result.script.slug}/builds`}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label="Back to build history"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Tooltip>
          <div>
            <h1 className="text-2xl font-bold text-white">Build Detail</h1>
            <p className="mt-1 font-mono text-xs text-zinc-500">{result.build.buildId}</p>
          </div>
        </div>
        <RebuildButton slug={result.script.slug} />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{result.script.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">/{result.script.slug}</p>
          </div>
          <BuildStatusBadge status={result.build.status} />
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <dt className="text-xs uppercase tracking-wider text-zinc-500">Build Version</dt>
            <dd className="mt-2 font-mono text-sm text-zinc-300">{result.build.buildVersion}</dd>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <dt className="text-xs uppercase tracking-wider text-zinc-500">Payload Format</dt>
            <dd className="mt-2 font-mono text-sm text-zinc-300">{result.build.payloadFormatVersion}</dd>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <dt className="text-xs uppercase tracking-wider text-zinc-500">Encryption Scheme</dt>
            <dd className="mt-2 font-mono text-sm text-zinc-300">{result.build.encryptionScheme}</dd>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <dt className="text-xs uppercase tracking-wider text-zinc-500">Payload Size</dt>
            <dd className="mt-2 text-sm text-zinc-300">
              {result.build.payloadByteSize === null ? '—' : `${result.build.payloadByteSize} bytes`}
            </dd>
          </div>
        </dl>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">Created</dt>
            <dd className="mt-1 text-sm text-zinc-300">{formatDateTime(result.build.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Updated</dt>
            <dd className="mt-1 text-sm text-zinc-300">{formatDateTime(result.build.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Built At</dt>
            <dd className="mt-1 text-sm text-zinc-300">{dateOrDash(result.build.builtAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Invalidated At</dt>
            <dd className="mt-1 text-sm text-zinc-300">{dateOrDash(result.build.invalidatedAt)}</dd>
          </div>
        </dl>

        {result.build.status === 'failed' && (
          <div className="mt-6 rounded-lg border border-red-900/50 bg-red-950/20 p-4">
            <h2 className="text-sm font-semibold text-red-400">Failure Details</h2>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-xs text-zinc-500">Error Code</dt>
                <dd className="mt-1 font-mono text-sm text-red-300">
                  {stringOrDash(result.build.errorCode)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Error Message</dt>
                <dd className="mt-1 text-sm text-zinc-300">
                  {stringOrDash(result.build.errorMessage)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {result.build.invalidatedReason && (
          <div className="mt-6 rounded-lg border border-amber-900/50 bg-amber-950/10 p-4">
            <h2 className="text-sm font-semibold text-amber-400">Invalidation</h2>
            <p className="mt-2 font-mono text-xs text-zinc-300">{result.build.invalidatedReason}</p>
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-white">Build Metadata</h2>
          {metadataEntries.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No metadata recorded.</p>
          ) : (
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <dt className="font-mono text-xs text-zinc-500">{key}</dt>
                  <dd className="mt-1 break-words text-sm text-zinc-300">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
