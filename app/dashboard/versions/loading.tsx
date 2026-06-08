export default function VersionsLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-pulse">
      <div>
        <div className="h-7 w-28 rounded-md bg-zinc-800" />
        <div className="mt-1 h-4 w-56 rounded-md bg-zinc-800" />
      </div>

      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="h-4 w-32 rounded bg-zinc-800" />
            <div className="mt-1 h-3 w-48 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  )
}
