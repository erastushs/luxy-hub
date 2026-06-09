export default function VersionHistoryLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded bg-zinc-800" />
        <div>
          <div className="h-7 w-36 rounded-md bg-zinc-800" />
          <div className="mt-1 h-4 w-48 rounded-md bg-zinc-800" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="h-4 w-24 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-3 w-20 rounded bg-zinc-800" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-zinc-800" />
          ))}
        </div>
      </div>
    </div>
  )
}
