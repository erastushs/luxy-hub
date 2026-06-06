'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { config } from '../data/config'

export default function Navbar({ keyPage = false }: { keyPage?: boolean }) {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [activeSection, setActiveSection] = useState('top')

  useEffect(() => {
    if (keyPage) return

    const sections = ['top', 'games', 'changelog', 'faq']

    const observers = sections.map((id) => {
      const section = document.getElementById(id)

      if (!section) return null

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id)
          }
        },
        {
          rootMargin: '-30% 0px -50% 0px',
        },
      )

      observer.observe(section)

      return observer
    })

    return () => {
      observers.forEach((observer) => {
        observer?.disconnect()
      })
    }
  }, [keyPage])

  return (
    <nav className="sticky top-0 z-50 border-b border-red-950/40 bg-black/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 shadow-[0_0_25px_rgba(239,68,68,0.35)]">
            <Image src="/LH.webp" alt="Luxy Hub" width={32} height={32} className="rounded-lg" />
          </div>

          <span className="text-xl font-bold">LUXY HUB</span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden items-center gap-8 md:flex">
          {keyPage ? (
            <>
              <Link href="/" className="transition hover:text-red-500">
                Home
              </Link>

              <Link href="/get-key" className="text-red-500">
                Get Key
              </Link>
            </>
          ) : (
            <>
              <a href="#top" className={activeSection === 'top' ? 'text-red-500' : 'transition hover:text-red-500'}>
                Home
              </a>

              <a href="#games" className={activeSection === 'games' ? 'text-red-500' : 'transition hover:text-red-500'}>
                Games
              </a>

              <a
                href="#changelog"
                className={activeSection === 'changelog' ? 'text-red-500' : 'transition hover:text-red-500'}
              >
                Changelog
              </a>

              <a href="#faq" className={activeSection === 'faq' ? 'text-red-500' : 'transition hover:text-red-500'}>
                FAQ
              </a>
            </>
          )}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          <a
            href={config.discord}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2 text-red-400 transition-all duration-300 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] md:block"
          >
            Join Discord
          </a>

          <button className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenu && (
        <div className="border-t border-red-950/40 bg-black md:hidden">
          <div className="flex flex-col gap-5 p-5">
            {keyPage ? (
              <>
                <Link href="/" onClick={() => setMobileMenu(false)} className="transition hover:text-red-500">
                  Home
                </Link>

                <Link href="/get-key" onClick={() => setMobileMenu(false)} className="text-red-500">
                  Get Key
                </Link>
              </>
            ) : (
              <>
                <a
                  href="#top"
                  onClick={() => setMobileMenu(false)}
                  className={activeSection === 'top' ? 'text-red-500' : ''}
                >
                  Home
                </a>

                <a
                  href="#games"
                  onClick={() => setMobileMenu(false)}
                  className={activeSection === 'games' ? 'text-red-500' : ''}
                >
                  Games
                </a>

                <a
                  href="#changelog"
                  onClick={() => setMobileMenu(false)}
                  className={activeSection === 'changelog' ? 'text-red-500' : ''}
                >
                  Changelog
                </a>

                <a
                  href="#faq"
                  onClick={() => setMobileMenu(false)}
                  className={activeSection === 'faq' ? 'text-red-500' : ''}
                >
                  FAQ
                </a>
              </>
            )}

            <a
              href={config.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-center text-red-400 transition hover:bg-red-500/20"
            >
              Join Discord
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
