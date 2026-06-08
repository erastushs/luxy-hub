import { cn } from '@/app/lib/utils'
import { getVisibilityBadge } from '@/app/dashboard/lib/visibility'

type TopScript = {
  name: string
  slug: string
  visibility: string
  downloads: number
}

type TopScriptsTableProps = {
  scripts: TopScript[]
}

export function TopScriptsTable({ scripts }: TopScriptsTableProps) {
  if (scripts.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-sm text-zinc-500">No script analytics available yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Script
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Visibility
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Downloads
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {scripts.map((script, i) => {
            const vis = getVisibilityBadge(script.visibility)
            const VisIcon = vis.icon

            return (
              <tr key={script.slug} className="transition hover:bg-zinc-900/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-zinc-600 w-5 text-right" aria-label={`Rank ${i + 1}`}>
                      {i + 1}
                    </span>
                    <span className="font-medium text-white">{script.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      vis.className
                    )}
                  >
                    <VisIcon className="h-3 w-3" aria-hidden="true" />
                    {vis.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-white tabular-nums">
                  {script.downloads.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
