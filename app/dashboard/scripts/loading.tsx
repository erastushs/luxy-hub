export default function ScriptsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-7 w-24 rounded-md bg-zinc-800" />
          <div className="mt-1 h-4 w-36 rounded-md bg-zinc-800" />
        </div>
        <div className="h-10 w-28 rounded-lg bg-zinc-800" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="h-10 flex-1 rounded-lg bg-zinc-800" />
        <div className="h-10 w-40 rounded-lg bg-zinc-800" />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-16">
        <div className="mx-auto h-12 w-12 rounded-full bg-zinc-800" />
        <div className="mx-auto mt-4 h-4 w-28 rounded bg-zinc-800" />
        <div className="mx-auto mt-1 h-3 w-44 rounded bg-zinc-800" />
      </div>
    </div>
  )
}
