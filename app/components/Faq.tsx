'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { faq } from '../data/faq'

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="mx-auto max-w-5xl px-4 py-24">
      <div className="mb-14 text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.35em] text-red-500">Support</p>

        <h2 className="text-5xl font-black">FAQ</h2>
      </div>

      <div className="space-y-5">
        {faq.map((item, index) => (
          <div key={item.question} className="overflow-hidden rounded-3xl border border-red-950/40 bg-zinc-950">
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="flex w-full items-center justify-between px-6 py-5 text-left"
            >
              <span className="text-lg font-semibold">{item.question}</span>

              <ChevronDown
                className={`transition duration-300 ${openIndex === index ? 'rotate-180 text-red-500' : ''}`}
              />
            </button>

            <div
              className={`grid transition-all duration-300 ${
                openIndex === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-6 text-zinc-400">
                  {item.discord ? (
                    <>
                      Join our{' '}
                      <a
                        href="https://discord.gg/Gr5UQUKp7"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-500 transition hover:text-red-400"
                      >
                        Discord Server
                      </a>{' '}
                      and head to the #need-help channel, we&apos;ll get you sorted.
                    </>
                  ) : (
                    item.answer
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
