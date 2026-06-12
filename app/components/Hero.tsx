'use client'

import Image from 'next/image'
import { useState } from 'react'
import { toast } from 'sonner'
import { motion, useScroll, useTransform } from 'framer-motion'
import Typewriter from './Typewriter'
import { config } from '../data/config'

export default function Hero() {
  const [copied, setCopied] = useState(false)
  const { scrollY } = useScroll()

  const y = useTransform(scrollY, [0, 1000], [0, 350])

  const script = config.mainScript
  const previewUrl = script.match(/"([^"]+)"/)?.[1] ?? '/api/...'

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script)

      setCopied(true)

      toast.success('Script copied successfully!')

      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      toast.error('Failed to copy script.')
    }
  }

  return (
    <section id="top" className="mx-auto max-w-7xl px-2 sm:px-4 py-4 lg:py-8">
      <div className="overflow-hidden rounded-3xl border border-red-900/40 bg-zinc-950">
        <div className="grid grid-cols-1 lg:min-h-[75vh] lg:grid-cols-2">
          {/* Character Image Desktop Only */}
          <motion.div
            style={{ y }}
            className="relative hidden min-h-[350px] overflow-hidden lg:block lg:order-2 lg:min-h-full"
          >
            {' '}
            <div className="absolute right-10 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-red-500/20 blur-[120px]" />
            <Image
              src="/bg.webp"
              alt="Luxy Hub"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover brightness-90"
            />
            <div className="absolute inset-0 bg-red-500/5 mix-blend-screen" />
            <div className="absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-red-500/25 blur-[160px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent lg:bg-gradient-to-r lg:from-zinc-950 lg:via-transparent lg:to-transparent" />
          </motion.div>
          {/* Content */}
          <div className="relative order-2 flex items-center p-5 sm:p-8 lg:order-1 lg:p-12">
            {/* Mobile Background */}
            <div className="absolute inset-0 lg:hidden">
              <Image src="/bg.webp" alt="Luxy Hub" fill priority sizes="100vw" className="object-cover opacity-20" />

              <div className="absolute inset-0 bg-black/80" />
            </div>

            <div className="relative z-10">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.4em] text-red-500">Welcome To</p>
              <h1 className="text-5xl font-black leading-none sm:text-6xl lg:text-7xl">
                <span className="text-red-500">LUXY</span> HUB
              </h1>

              <h2 className="mt-5 text-2xl font-bold lg:text-3xl">The Ultimate Roblox Script Library</h2>

              <div className="mt-5">
                <Typewriter />
              </div>

              {/* Script Preview */}
              <div className="mt-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-red-500/20 bg-black/90 shadow-[0_0_30px_rgba(239,68,68,0.08)]">
                <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />

                  <span className="ml-2 text-sm text-zinc-500">main.lua</span>
                </div>

                <div className="p-5">
                  <code className="font-mono text-base leading-9 break-all">
                    <span className="text-red-400">loadstring</span>
                    <span className="text-zinc-300">(</span>

                    <span className="text-red-300">game:HttpGet</span>

                    <span className="text-zinc-300">(</span>

                    <span className="text-zinc-500">{`"${previewUrl.replace('/loader/luxyhub', '/...')}`}</span>

                    <span className="mx-1 text-red-500">...</span>

                    <span className="text-zinc-500">{'/luxyhub"'}</span>

                    <span className="text-zinc-300">))()</span>
                  </code>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={copyScript}
                  className="rounded-xl bg-red-600 px-6 py-3 font-semibold transition-all duration-300 hover:bg-red-500 hover:shadow-[0_0_25px_rgba(239,68,68,0.45)]"
                >
                  {copied ? 'Copied!' : 'Copy Script'}
                </button>

                <a
                  href={config.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-zinc-700 px-6 py-3 transition hover:border-red-500 hover:text-red-400"
                >
                  Join Discord
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
