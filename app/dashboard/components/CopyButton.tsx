'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/app/lib/utils'

type CopyButtonProps = {
  value: string
  label?: string
  compact?: boolean
}

export function CopyButton({ value, label, compact = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('Copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }

  const buttonLabel = label
    ? label.toLowerCase().startsWith('copy ')
      ? label
      : `Copy ${label}`
    : 'Copy'

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-zinc-800 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
        compact ? 'px-2 py-1' : 'px-2.5 py-1'
      )}
      title={buttonLabel}
      aria-label={buttonLabel}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {copied ? 'Copied' : label ?? 'Copy'}
    </button>
  )
}
