/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import Image from 'next/image'
import { games } from '../data/games'
import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import GameModal from './GameModal'

export default function FeaturedGames() {
  const [selectedGame, setSelectedGame] = useState<any>(null)
  const statusColor: Record<string, string> = {
    Working: 'bg-green-500/10 text-green-400',
    Updating: 'bg-yellow-500/10 text-yellow-400',
    Broken: 'bg-red-500/10 text-red-400',
  }
  return (
    <section id="games" className="mx-auto max-w-7xl px-4 py-14">
      <div className="mb-12">
        <p className="mb-2 text-sm uppercase tracking-[0.3em] text-red-500">Games</p>

        <h2 className="text-4xl font-black">Featured Games</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <div
            key={game.title}
            className="
group
overflow-hidden
rounded-3xl
border
border-zinc-800
bg-zinc-950
transition-all
duration-300

hover:border-red-500/60
hover:shadow-[0_0_35px_rgba(239,68,68,0.18)]
"
          >
            <div className="relative h-52">
              <Image
                src={game.image}
                alt={game.title}
                fill
                className="
    object-cover
    transition-transform
    duration-500
    group-hover:scale-105
  "
              />
            </div>

            <div className="p-5">
              <h3 className="text-xl font-bold">{game.title}</h3>

              <div className="mt-3 flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-sm ${statusColor[game.status]}`}>{game.status}</span>
                <span className="text-sm text-zinc-400">{game.features} Features</span>
              </div>

              <button
                onClick={() => setSelectedGame(game)}
                className="mt-5 w-full rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-red-400 transition hover:bg-red-500/20"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {selectedGame && <GameModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
      </AnimatePresence>
    </section>
  )
}
