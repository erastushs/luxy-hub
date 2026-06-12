import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { docsSections, getRelatedDocs, type DocsSection } from './docs-data'

type DocsShellProps = {
  activeSection?: DocsSection
  children: React.ReactNode
}

const groups = ['Start', 'Build', 'Operate', 'Reference'] as const

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function DocsShell({ activeSection, children }: DocsShellProps) {
  const relatedDocs = activeSection ? getRelatedDocs(activeSection) : docsSections.slice(0, 3)

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-200">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-[#0d0d0d]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-400 transition hover:bg-gray-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Dashboard
          </Link>
          <Link href="/docs" className="text-sm font-semibold text-white">
            LuxyHub Docs
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[17rem_minmax(0,1fr)_15rem]">
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <nav className="rounded-xl border border-gray-800 bg-gray-950/60 p-3" aria-label="Documentation navigation">
            {groups.map((group) => (
              <div key={group} className="mb-4 last:mb-0">
                <p className="px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{group}</p>
                <div className="mt-1 space-y-1">
                  {docsSections
                    .filter((section) => section.group === group)
                    .map((section) => {
                      const active = section.href === activeSection?.href

                      return (
                        <Link
                          key={section.href}
                          href={section.href}
                          className={cn(
                            'block rounded-lg px-2 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
                            active
                              ? 'bg-red-600/10 text-red-300'
                              : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                          )}
                          aria-current={active ? 'page' : undefined}
                        >
                          {section.title}
                        </Link>
                      )
                    })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-500" aria-label="Breadcrumbs">
            <Link href="/docs" className="hover:text-gray-300">Docs</Link>
            {activeSection && (
              <>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                <span className="text-gray-300">{activeSection.title}</span>
              </>
            )}
          </nav>

          {activeSection && (
            <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-950/50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">{activeSection.group}</p>
              <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{activeSection.title}</h1>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-400">{activeSection.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {activeSection.quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-gray-800 bg-black/20 px-3 py-1.5 text-sm text-gray-300 transition hover:border-gray-600 hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {children}
        </main>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {activeSection && (
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">On this page</h2>
              <div className="mt-3 space-y-2">
                {activeSection.sectionNav.map((item) => (
                  <a key={item} href={`#${slugify(item)}`} className="block text-sm text-gray-400 hover:text-white">
                    {item}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
            <h2 className="text-sm font-semibold text-white">Related Articles</h2>
            <div className="mt-3 space-y-3">
              {relatedDocs.map((section) => (
                <Link key={section.href} href={section.href} className="block rounded-lg border border-gray-800 p-3 transition hover:border-gray-600 hover:bg-gray-900/60">
                  <span className="text-sm font-medium text-gray-200">{section.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-gray-500">{section.description}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
