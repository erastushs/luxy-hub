import { CopyLoaderButton } from '@/app/dashboard/components/CopyLoaderButton'
import { CopyButton } from '@/app/dashboard/components/CopyButton'
import { getLoaderSnippet, getLoaderUrl } from '@/app/dashboard/lib/loader-snippet'

type LoaderSnippetCardProps = {
  slug: string
}

export function LoaderSnippetCard({ slug }: LoaderSnippetCardProps) {
  const loaderUrl = getLoaderUrl(slug)
  const snippet = getLoaderSnippet(slug)

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Loader Snippet</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Use this bootstrap URL in supported executors.
          </p>
        </div>
        <CopyLoaderButton slug={slug} />
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Loader URL
            </span>
            <CopyButton value={loaderUrl} label="URL" compact />
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
            <code className="whitespace-nowrap font-mono text-xs text-zinc-300">
              {loaderUrl}
            </code>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Loader Code
            </span>
            <CopyButton value={snippet} label="Snippet" compact />
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
            <code className="whitespace-nowrap font-mono text-xs text-zinc-300">
              {snippet}
            </code>
          </div>
        </div>
      </div>
    </section>
  )
}
