/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import type { MouseEvent } from 'react'

export default function GameModal({ game, onClose }: { game: any; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  if (!game) return null

  const statusColor = {
    Working: 'bg-green-500/10 text-green-400',
    Updating: 'bg-yellow-500/10 text-yellow-400',
    Broken: 'bg-red-500/10 text-red-400',
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="
          w-full
          max-w-xl
          max-h-[85vh]
          overflow-y-auto
          rounded-3xl
          border
          border-red-500/20
          bg-zinc-950
          shadow-[0_0_50px_rgba(255,0,0,0.15)]
        "
      >
        <div className="relative h-44 md:h-56">
          {!loaded && <div className="absolute inset-0 animate-pulse bg-zinc-900" />}

          <Image
            src={game.image}
            alt={game.title}
            fill
            onLoad={() => setLoaded(true)}
            className={`object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg bg-black/70 p-2 transition hover:bg-red-500/20"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold md:text-3xl">{game.title}</h2>

            <span className={`rounded-full px-3 py-1 text-sm ${statusColor[game.status as keyof typeof statusColor]}`}>
              {game.status}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-500">
            <span>⚡ {game.features} Features</span>
            <span>📅 {game.lastUpdate}</span>
          </div>

          <p className="mt-4 text-zinc-400">{game.description}</p>

          <div className="mt-6">
            <h3 className="mb-4 font-semibold text-red-400">Features</h3>

            {game.featureList.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {game.featureList.map((feature: string) => (
                  <span
                    key={feature}
                    className="
                        rounded-full
                        border
                        border-red-500/20
                        bg-gradient-to-r
                        from-red-500/10
                        to-red-800/10
                        px-4
                        py-2
                        text-sm
                        font-medium
                        text-red-200
                        transition-all
                        duration-300
                        hover:scale-105
                        hover:border-red-500/40
                        hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]
                      "
                  >
                    {feature}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-500">
                Features coming soon.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
