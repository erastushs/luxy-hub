export default function VersionDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-pulse">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-6">
        <div className="h-4 w-28 rounded bg-zinc-800" />
        <div className="flex items-start justify-between">
          <div>
            <div className="h-6 w-36 rounded bg-zinc-800" />
            <div className="mt-1 h-4 w-48 rounded bg-zinc-800" />
          </div>
        </div>
        <div className="h-48 rounded-lg bg-zinc-800" />
      </div>
    </div>
  )
}
