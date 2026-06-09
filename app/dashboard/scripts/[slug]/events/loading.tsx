export default function EventsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-pulse">
      <div className="h-7 w-40 rounded bg-zinc-800" />
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="h-9 w-32 rounded-lg bg-zinc-800" />
          <div className="h-9 w-32 rounded-lg bg-zinc-800" />
        </div>
        <div className="rounded-xl border border-zinc-800">
          <div className="h-[300px] bg-zinc-900/50" />
        </div>
      </div>
    </div>
  )
}
