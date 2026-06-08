import type { ReactNode } from 'react'

type TooltipProps = {
  text: string
  children: ReactNode
  side?: 'top' | 'bottom'
}

export function Tooltip({ text, children, side = 'top' }: TooltipProps) {
  const positionClass = side === 'top'
    ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
    : 'left-1/2 top-full mt-2 -translate-x-1/2'

  return (
    <span className="group/tooltip relative inline-flex" title={text}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden max-w-48 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-medium text-zinc-200 opacity-0 shadow-lg shadow-black/30 transition group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 sm:block ${positionClass}`}
      >
        {text}
      </span>
    </span>
  )
}
