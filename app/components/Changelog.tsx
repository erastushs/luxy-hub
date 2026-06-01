'use client'

import { useState } from 'react'
import { changelog } from '../data/changelog'

export default function Changelog() {
  const [visibleCount, setVisibleCount] = useState(2)

  const visibleChangelog = changelog.slice(0, visibleCount)
  return (
    <section id="changelog" className="mx-auto max-w-7xl px-4 py-16">
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 p-8">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-red-500">Changelog</p>

          <h2 className="text-4xl font-black text-white">Latest Updates</h2>

          <p className="mt-3 text-zinc-400">
            Track the latest LuxyHub releases, improvements, fixes, and new game support.
          </p>
        </div>

        <div className="divide-y divide-zinc-800">
          {visibleChangelog.map((entry) => (
            <div key={entry.version} className="p-6 transition-colors hover:bg-zinc-900/40">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-400">
                    {entry.version}
                  </span>

                  <span className="text-sm text-zinc-500">{entry.date}</span>
                </div>
              </div>

              <ul className="space-y-2">
                {entry.changes.map((change) => (
                  <li key={change} className="flex items-start gap-3 text-zinc-300">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-red-500" />

                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {visibleCount < changelog.length && (
          <div className="p-6 text-center">
            <button
              onClick={() => setVisibleCount((prev) => prev + 3)}
              className="
        rounded-xl
        border
        border-red-500/30
        bg-red-500/10
        px-5
        py-2.5
        text-sm
        font-medium
        text-red-400
        transition
        hover:bg-red-500/20
      "
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
