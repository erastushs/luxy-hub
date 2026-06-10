export default function AlertsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-6 w-36 rounded bg-zinc-800" />
        <div className="mt-2 h-4 w-64 rounded bg-zinc-800" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 rounded-lg border border-zinc-800 bg-zinc-900/50" />
        <div className="h-24 rounded-lg border border-zinc-800 bg-zinc-900/50" />
        <div className="h-24 rounded-lg border border-zinc-800 bg-zinc-900/50" />
      </div>

      <div className="flex gap-3">
        <div className="h-8 w-48 rounded bg-zinc-800" />
        <div className="h-8 w-64 rounded bg-zinc-800" />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
        <div className="h-12 border-b border-zinc-800" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 border-b border-zinc-800/50" />
        ))}
      </div>
    </div>
  )
}
