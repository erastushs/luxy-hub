export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-24 rounded-md bg-zinc-800" />
          <div className="mt-1 h-4 w-36 rounded-md bg-zinc-800" />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-zinc-800" />
          <div>
            <div className="h-5 w-36 rounded bg-zinc-800" />
            <div className="mt-1 h-4 w-48 rounded bg-zinc-800" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
              <div className="h-3 w-16 rounded bg-zinc-800" />
              <div className="mt-1 h-4 w-28 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
