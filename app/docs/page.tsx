import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documentation | LuxyHub',
  description: 'LuxyHub documentation knowledge base for scripts, keys, licenses, delivery, analytics, operations, and API reference.',
}

const sections = [
  {
    title: 'Getting Started',
    href: '/docs/api',
    description: 'Start with runtime contracts, request examples, and response shapes.',
  },
  {
    title: 'Scripts',
    href: '/docs/api',
    description: 'Script metadata, visibility, access modes, and delivery session APIs.',
  },
  {
    title: 'Keys',
    href: '/docs/api',
    description: 'Free key validation, Work.ink flow, and current API behavior.',
  },
  {
    title: 'Licenses',
    href: '/docs/api',
    description: 'Premium runtime licensing, assignments, and authorization contracts.',
  },
  {
    title: 'Delivery',
    href: '/docs/api',
    description: 'Secure delivery sessions, runtime payload fetch, and loader flow.',
  },
  {
    title: 'Analytics',
    href: '/docs/api',
    description: 'Analytics V2 metrics are documented in repository docs and surfaced in dashboard pages.',
  },
  {
    title: 'Operations',
    href: '/docs/event-platform',
    description: 'Event queue, webhooks, monitoring, and operational runbooks.',
  },
  {
    title: 'Reference',
    href: '/docs/api',
    description: 'Canonical API reference for exact contracts and response shapes.',
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
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-16 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to LuxyHub
        </Link>

        <h1 className="text-4xl font-bold text-white mb-3">Documentation</h1>
        <p className="text-gray-400 mb-8 text-lg">
          Knowledge base for scripts, keys, licenses, secure delivery, analytics, operations, and API reference.
        </p>

        <div className="mb-10 rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Popular tasks</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {popularTasks.map((task) => (
              <span key={task} className="rounded-full border border-gray-800 bg-black/20 px-3 py-1 text-sm text-gray-300">
                {task}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="group block rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-gray-600 hover:bg-gray-900 transition-colors"
            >
              <h2 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                {section.title}
              </h2>
              <p className="text-gray-400 mt-2 text-sm leading-relaxed">
                {section.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Related documents</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            Repository docs include `docs/GETTING_STARTED.md`, `docs/features/`, `docs/dashboard/`,
            `docs/runtime/`, `docs/operations/`, and `docs/audits/POST_RC_POLISH_AUDIT.md` for the full knowledge base.
          </p>
        </div>
      </div>
    </div>
  )
}
