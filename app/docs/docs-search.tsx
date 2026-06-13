'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type SearchResult = {
  title: string
  href: string
  description: string
  group: string
}

const searchIndex: SearchResult[] = [
  { title: 'Getting Started', href: '/docs/getting-started', description: 'First steps, source-of-truth documents, and the fastest path into LuxyHub workflows.', group: 'Start' },
  { title: 'Dashboard', href: '/docs/dashboard', description: 'Creator control-plane workflows for scripts, licenses, events, profile, and release validation.', group: 'Start' },
  { title: 'Event Platform', href: '/docs/event-platform', description: 'Event platform integration guide for connecting external services to LuxyHub event system.', group: 'Start' },
  { title: 'Event Platform Quickstart', href: '/docs/event-platform/quickstart', description: 'Quickstart guide for event platform integration.', group: 'Start' },
  { title: 'Scripts', href: '/docs/scripts', description: 'Script metadata, access modes, visibility, builds, versions, and creator workflows.', group: 'Build' },
  { title: 'Keys', href: '/docs/keys', description: 'Free key flow, validation behavior, and how keys relate to public access modes.', group: 'Build' },
  { title: 'Licenses', href: '/docs/licenses', description: 'Premium license management, runtime licensing, and assignment concepts.', group: 'Build' },
  { title: 'Delivery', href: '/docs/delivery', description: 'Secure script delivery, delivery sessions, loader integration, and runtime payloads.', group: 'Build' },
  { title: 'Analytics', href: '/docs/analytics', description: 'Analytics V2 surfaces, metrics interpretation, event platform context, and dashboard visibility.', group: 'Operate' },
  { title: 'Operations', href: '/docs/operations', description: 'Production deployment, monitoring, incident response, event queue, backups, and secret rotation.', group: 'Operate' },
  { title: 'Deployment', href: '/docs/operations/deployment', description: 'Production deployment checklist and environment configuration.', group: 'Operate' },
  { title: 'Monitoring', href: '/docs/operations/monitoring', description: 'Production monitoring configuration, health checks, alert thresholds.', group: 'Operate' },
  { title: 'Incident Response', href: '/docs/operations/incident-response', description: 'Incident response procedures, escalation paths, and common failure scenarios.', group: 'Operate' },
  { title: 'Backup & Recovery', href: '/docs/operations/backup-recovery', description: 'Backup strategies, disaster recovery procedures, and data restoration runbooks.', group: 'Operate' },
  { title: 'Production Validation', href: '/docs/operations/production-validation', description: 'Production validation reports, pre-release checks, and infrastructure readiness.', group: 'Operate' },
  { title: 'Reference', href: '/docs/reference', description: 'Canonical V1 API reference, active endpoint contracts, and response conventions.', group: 'Reference' },
  { title: 'API Reference', href: '/docs/reference/api', description: 'Complete V1 API reference with endpoint contracts and authentication.', group: 'Reference' },
  { title: 'Database Schema', href: '/docs/reference/database', description: 'Complete database schema, migrations history, and RLS policy documentation.', group: 'Reference' },
  { title: 'Architecture Overview', href: '/docs/reference/architecture', description: 'Current implementation architecture, route topology, and system design overview.', group: 'Reference' },
  { title: 'ADRs', href: '/docs/reference/adrs', description: 'Architecture Decision Records (ADR-001 through ADR-009).', group: 'Reference' },
  { title: 'Troubleshooting', href: '/docs/troubleshooting', description: 'Production issue diagnosis, common symptoms, validation checks, and escalation references.', group: 'Reference' },
  { title: 'Architecture', href: '/docs/architecture', description: 'Complete system architecture: route topology, runtime design, security posture.', group: 'Architecture' },
  { title: 'License System', href: '/docs/architecture/license-system', description: 'Phase 7 license architecture: access modes, keys, license authorization.', group: 'Architecture' },
  { title: 'Runtime', href: '/docs/architecture/runtime', description: 'Script runtime architecture: build pipeline, secure delivery, event queue.', group: 'Architecture' },
  { title: 'Decisions', href: '/docs/architecture/decisions', description: 'Architecture Decision Records (ADR-001 through ADR-009).', group: 'Architecture' },
  { title: 'Release Checklist', href: '/docs/releases/checklist', description: 'Release Candidate validation checklist.', group: 'Releases' },
  { title: 'Rollout Plan', href: '/docs/releases/rollout', description: 'Release Candidate rollout plan: pre-rollout requirements and validation gates.', group: 'Releases' },
  { title: 'Rollback Plan', href: '/docs/releases/rollback', description: 'Release Candidate rollback plan: rollback drill and recovery procedures.', group: 'Releases' },
  { title: 'Release Status', href: '/docs/releases/status', description: 'Current Release Candidate status, completed phases, and remaining requirements.', group: 'Releases' },
]

export function DocsSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const results = useMemo(() => {
    if (!query.trim()) return []
    const lower = query.toLowerCase()
    return searchIndex.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.href.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower) ||
        item.group.toLowerCase().includes(lower)
    )
  }, [query])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const navigate = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        navigate(results[selectedIndex].href)
      }
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-gray-500 transition hover:border-gray-700 hover:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search docs...</span>
        <kbd className="hidden rounded border border-gray-700 px-1.5 py-0.5 text-xs text-gray-600 sm:inline-block">
          Ctrl+K
        </kbd>
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false)
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-[#0d0d0d] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
              <Search className="h-5 w-5 text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search documentation..."
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
                autoComplete="off"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="rounded p-0.5 text-gray-600 hover:text-gray-400"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded border border-gray-700 px-1.5 py-0.5 text-xs text-gray-600 hover:text-gray-400"
              >
                ESC
              </button>
            </div>

            {results.length > 0 && (
              <div className="max-h-80 overflow-y-auto p-2">
                {results.map((result, i) => (
                  <Link
                    key={result.href}
                    href={result.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition ${
                      i === selectedIndex
                        ? 'bg-red-600/10 text-red-300'
                        : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">{result.title}</span>
                        <span className="shrink-0 rounded border border-gray-800 px-1.5 py-0.5 text-xs text-gray-600">
                          {result.group}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{result.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {query && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-600">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {!query && (
              <div className="px-4 py-6 text-center text-xs text-gray-600">
                Start typing to search documentation
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
