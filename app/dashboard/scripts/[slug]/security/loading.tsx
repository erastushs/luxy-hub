export default function SecurityLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="mb-1 h-4 w-24 rounded bg-zinc-800" />
        <div className="h-7 w-32 rounded bg-zinc-800" />
      </div>
      {/* 5 overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
          >
            <div className="h-3 w-20 rounded bg-zinc-800" />
            <div className="mt-3 h-7 w-14 rounded bg-zinc-800" />
            <div className="mt-2 h-3 w-24 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
      {/* 3 trend charts */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
          >
            <div className="mb-1 h-4 w-32 rounded bg-zinc-800" />
            <div className="h-48 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
      {/* Risk + Anomalies + Events table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
          >
            <div className="h-4 w-28 rounded bg-zinc-800" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full rounded bg-zinc-800" />
              <div className="h-3 w-2/3 rounded bg-zinc-800" />
              <div className="h-3 w-3/4 rounded bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="h-4 w-28 rounded bg-zinc-800" />
        <div className="mt-3 h-48 rounded bg-zinc-800" />
      </div>
    </div>
  )
}
