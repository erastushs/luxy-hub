'use client'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 text-center shadow-2xl shadow-black/30">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
          Dashboard unavailable
        </p>
        <h2 className="mt-3 text-xl font-semibold text-white">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          The dashboard could not finish loading. Your account details are safe; try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
