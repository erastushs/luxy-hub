import { History } from 'lucide-react'

export default function VersionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Versions</h1>
        <p className="mt-1 text-sm text-zinc-400">Track script version history</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <History className="mx-auto h-8 w-8 text-zinc-600" />
        <h3 className="mt-3 text-sm font-medium text-zinc-300">
          Version History
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          View and manage script versions. Full version history UI coming soon.
        </p>
      </div>
    </div>
  )
}
