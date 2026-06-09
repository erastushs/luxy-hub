export default function WebhooksLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg animate-pulse bg-zinc-800" />
        <div>
          <div className="h-6 w-32 rounded animate-pulse bg-zinc-800" />
          <div className="mt-1 h-4 w-20 rounded animate-pulse bg-zinc-800" />
        </div>
      </div>
      <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="h-10 w-full rounded-lg animate-pulse bg-zinc-800" />
        <div className="h-10 w-full rounded-lg animate-pulse bg-zinc-800" />
        <div className="h-14 w-full rounded-lg animate-pulse bg-zinc-800" />
        <div className="flex justify-end">
          <div className="h-9 w-32 rounded-lg animate-pulse bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}
