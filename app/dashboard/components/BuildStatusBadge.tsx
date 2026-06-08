import { AlertTriangle, CheckCircle2, Clock3, Hammer, RotateCcw } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import type { DeliveryBuildStatus } from '@/app/lib/repositories/delivery-build-repository'

export type DashboardBuildStatus = DeliveryBuildStatus | 'not_built'

const DISPLAY = {
  ready: {
    label: 'Ready',
    className: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    icon: CheckCircle2,
  },
  building: {
    label: 'Building',
    className: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
    icon: Hammer,
  },
  pending: {
    label: 'Building',
    className: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
    icon: Clock3,
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/10 text-red-400 ring-red-500/20',
    icon: AlertTriangle,
  },
  invalidated: {
    label: 'Invalidated',
    className: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    icon: RotateCcw,
  },
  not_built: {
    label: 'Not built',
    className: 'bg-zinc-800 text-zinc-400 ring-zinc-700',
    icon: Clock3,
  },
} satisfies Record<DashboardBuildStatus, { label: string; className: string; icon: typeof CheckCircle2 }>

export function getBuildStatusDisplay(status: DashboardBuildStatus) {
  return DISPLAY[status]
}

export function BuildStatusBadge({
  status,
  className,
}: {
  status: DashboardBuildStatus
  className?: string
}) {
  const display = getBuildStatusDisplay(status)
  const Icon = display.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        display.className,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {display.label}
    </span>
  )
}
