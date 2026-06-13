import Link from 'next/link'
import type { Metadata } from 'next'
import { DocsShell } from './docs-shell'
import { docsSections } from './docs-data'

export const metadata: Metadata = {
  title: 'Documentation | LuxyHub',
  description: 'LuxyHub documentation knowledge base for scripts, keys, licenses, delivery, analytics, operations, and API reference.',
}

const featuredDocs = [
  { title: 'Getting Started', href: '/docs/getting-started', desc: 'First steps and fastest path into LuxyHub workflows.' },
  { title: 'API Reference', href: '/docs/reference/api', desc: 'Complete V1 API reference with endpoint contracts.' },
  { title: 'Database Schema', href: '/docs/reference/database', desc: 'Full schema, migrations, and RLS policies.' },
  { title: 'Architecture', href: '/docs/architecture', desc: 'System architecture and design decisions.' },
]

const centers = [
  {
    title: 'Reference Center',
    href: '/docs/reference',
    description: 'API reference, database schema, architecture overview, and Architecture Decision Records.',
    links: [
      { label: 'API Reference', href: '/docs/reference/api' },
      { label: 'Database Schema', href: '/docs/reference/database' },
      { label: 'Architecture Overview', href: '/docs/reference/architecture' },
      { label: 'ADRs', href: '/docs/reference/adrs' },
    ],
  },
  {
    title: 'Architecture Center',
    href: '/docs/architecture',
    description: 'System topology, license architecture, runtime design, and architectural decisions.',
    links: [
      { label: 'Architecture', href: '/docs/architecture' },
      { label: 'License System', href: '/docs/architecture/license-system' },
      { label: 'Runtime', href: '/docs/architecture/runtime' },
      { label: 'Decisions', href: '/docs/architecture/decisions' },
    ],
  },
  {
    title: 'Release Center',
    href: '/docs/releases/checklist',
    description: 'Release Candidate checklist, rollout plan, rollback plan, and status tracking.',
    links: [
      { label: 'Release Checklist', href: '/docs/releases/checklist' },
      { label: 'Rollout Plan', href: '/docs/releases/rollout' },
      { label: 'Rollback Plan', href: '/docs/releases/rollback' },
      { label: 'Release Status', href: '/docs/releases/status' },
    ],
  },
  {
    title: 'Operations Center',
    href: '/docs/operations',
    description: 'Production deployment, monitoring, incident response, backup & recovery, and validation.',
    links: [
      { label: 'Operations Overview', href: '/docs/operations' },
      { label: 'Deployment', href: '/docs/operations/deployment' },
      { label: 'Monitoring', href: '/docs/operations/monitoring' },
      { label: 'Incident Response', href: '/docs/operations/incident-response' },
      { label: 'Backup & Recovery', href: '/docs/operations/backup-recovery' },
    ],
  },
]

const popularTasks = [
  'Create a script and choose an access mode',
  'Validate a free key or premium license',
  'Create a delivery session',
  'Send signed runtime events',
  'Troubleshoot webhook delivery',
]

export default function DocsIndexPage() {
  return (
    <DocsShell>
      <div className="rounded-2xl border border-gray-800 bg-gray-950/50 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Knowledge Base</p>
        <h1 className="mt-2 text-4xl font-bold text-white">Documentation</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-gray-400">
          Structured guides for scripts, keys, licenses, secure delivery, analytics, dashboard workflows, operations, and reference material.
        </p>

        <div className="mt-8 rounded-xl border border-gray-800 bg-black/20 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Popular Tasks</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {popularTasks.map((task) => (
              <span key={task} className="rounded-full border border-gray-800 bg-black/20 px-3 py-1 text-sm text-gray-300">
                {task}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Featured Docs</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {featuredDocs.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className="group block rounded-xl border border-gray-800 bg-gray-950/50 p-4 transition-colors hover:border-gray-600 hover:bg-gray-900/70"
            >
              <h3 className="text-base font-semibold text-white transition-colors group-hover:text-red-300">
                {doc.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">{doc.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {centers.map((center) => (
          <div key={center.title} className="rounded-xl border border-gray-800 bg-gray-950/50 p-5">
            <Link href={center.href} className="group">
              <h3 className="text-lg font-semibold text-white transition-colors group-hover:text-red-300">
                {center.title}
              </h3>
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{center.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {center.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-gray-800 bg-black/20 px-2.5 py-1 text-xs text-gray-400 transition hover:border-gray-600 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-gray-800 bg-gray-950/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">All Sections</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docsSections.filter(s => !s.parent).sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title)).map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-gray-900/70"
            >
              <span className="rounded border border-gray-800 px-1.5 py-0.5 text-xs text-gray-600 shrink-0">
                {section.group}
              </span>
              <span className="text-sm text-gray-300 hover:text-white">{section.title}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-gray-800 bg-gray-950/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Source documents</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          This knowledge base presents active repository documentation from `docs/GETTING_STARTED.md`, `docs/features/`, `docs/dashboard/`, `docs/runtime/`, `docs/operations/`, `docs/architecture/`, `docs/database/`, `docs/releases/`, and `docs/api/REFERENCE.md`.
        </p>
      </div>
    </DocsShell>
  )
}
