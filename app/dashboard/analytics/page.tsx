import { BarChart3 } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-400">View your script analytics</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-zinc-600" />
        <h3 className="mt-3 text-sm font-medium text-zinc-300">
          Detailed Analytics
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Download trends, per-script analytics, and charts coming soon.
        </p>
      </div>
    </div>
  )
}
