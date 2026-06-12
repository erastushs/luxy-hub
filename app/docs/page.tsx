import Link from 'next/link'
import type { Metadata } from 'next'
import { DocsShell } from './docs-shell'
import { docsSections } from './docs-data'

export const metadata: Metadata = {
  title: 'Documentation | LuxyHub',
  description: 'LuxyHub documentation knowledge base for scripts, keys, licenses, delivery, analytics, operations, and API reference.',
}

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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Popular tasks</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {popularTasks.map((task) => (
              <span key={task} className="rounded-full border border-gray-800 bg-black/20 px-3 py-1 text-sm text-gray-300">
                {task}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {docsSections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="group block rounded-xl border border-gray-800 bg-gray-950/50 p-5 transition-colors hover:border-gray-600 hover:bg-gray-900/70"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{section.group}</p>
            <h2 className="mt-2 text-xl font-semibold text-white transition-colors group-hover:text-red-300">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              {section.description}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-gray-800 bg-gray-950/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Source documents</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          This knowledge base presents active repository documentation from `docs/GETTING_STARTED.md`, `docs/features/`, `docs/dashboard/`, `docs/runtime/`, `docs/operations/`, and `docs/api/REFERENCE.md`.
        </p>
      </div>
    </DocsShell>
  )
}
