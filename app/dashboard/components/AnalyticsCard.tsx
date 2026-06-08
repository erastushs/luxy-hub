import { type LucideIcon } from 'lucide-react'

type AnalyticsCardProps = {
  label: string
  value: number | string
  icon: LucideIcon
  sublabel?: string
}

export function AnalyticsCard({ label, value, icon: Icon, sublabel }: AnalyticsCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className="h-4 w-4 text-zinc-600" />
      </div>
      <div className="mt-3">
        <span className="text-2xl font-bold text-white">{value}</span>
        {sublabel && (
          <span className="ml-2 text-xs text-zinc-500">{sublabel}</span>
        )}
      </div>
    </div>
  )
}
