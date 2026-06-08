export default function AnalyticsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-7 w-28 rounded-md bg-zinc-800" />
        <div className="mt-1 h-4 w-48 rounded-md bg-zinc-800" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="h-3 w-20 rounded bg-zinc-800" />
            <div className="mt-3 h-7 w-12 rounded bg-zinc-800" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="h-4 w-36 rounded bg-zinc-800" />
            <div className="mt-4 h-40 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  )
}
