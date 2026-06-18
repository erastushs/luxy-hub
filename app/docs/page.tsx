import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documentation | LuxyHub',
  description: 'LuxyHub developer documentation — API integration, Event Platform, and architecture guides.',
}

export default function DocsIndexPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-16 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        <h1 className="text-4xl font-bold text-white mb-3">Documentation</h1>
        <p className="text-gray-400 mb-12 text-lg">Developer guides for integrating with LuxyHub.</p>

        <div className="grid gap-6 sm:grid-cols-2">
          <Link
            href="/docs/api"
            className="group block rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-gray-600 hover:bg-gray-900 transition-colors"
          >
            <h2 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
              API Integration
            </h2>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              Validate API keys from Roblox Luau, Python, Node.js, and more.
              Covers key validation, rate limits, and error handling.
            </p>
          </Link>

          <Link
            href="/docs/event-platform"
            className="group block rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-gray-600 hover:bg-gray-900 transition-colors"
          >
            <h2 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
              Event Platform
            </h2>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              Integrate runtime telemetry — delivery sessions, HMAC-signed
              event reporting, and Discord webhook delivery.
            </p>
          </Link>

          <Link
            href="/docs/phase-7b-runtime-integration"
            className="group block rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-gray-600 hover:bg-gray-900 transition-colors"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-400">Phase 7</p>
            <h2 className="mt-2 text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
              Phase 7B Runtime Integration
            </h2>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              Implement runtime popup validation against <code className="rounded bg-gray-800 px-1 py-0.5 text-gray-200">POST /api/validate</code>
              before Main Script execution.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
