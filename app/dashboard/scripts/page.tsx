import { FileCode } from 'lucide-react'

export default function ScriptsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Scripts</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage your scripts</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <FileCode className="mx-auto h-8 w-8 text-zinc-600" />
        <h3 className="mt-3 text-sm font-medium text-zinc-300">
          Script Management
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Create, edit, and manage your scripts. Full script management UI coming soon.
        </p>
      </div>
    </div>
  )
}
