import { FileCode } from 'lucide-react'

type EmptyStateProps = {
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-16">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50">
        <FileCode className="h-6 w-6 text-zinc-500" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
