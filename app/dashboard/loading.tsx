export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-7 w-32 rounded-md bg-zinc-800" />
        <div className="mt-2 h-4 w-48 rounded-md bg-zinc-800" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="h-3 w-20 rounded bg-zinc-800" />
            <div className="mt-3 h-7 w-12 rounded bg-zinc-800" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
        <div className="mx-auto h-8 w-8 rounded bg-zinc-800" />
        <div className="mx-auto mt-3 h-4 w-32 rounded bg-zinc-800" />
        <div className="mx-auto mt-1 h-3 w-48 rounded bg-zinc-800" />
      </div>
    </div>
  )
}
