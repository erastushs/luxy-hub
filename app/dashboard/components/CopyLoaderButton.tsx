'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/app/lib/utils'
import { getLoaderSnippet } from '@/app/dashboard/lib/loader-snippet'
import { Tooltip } from '@/app/dashboard/components/Tooltip'

type CopyLoaderButtonProps = {
  slug: string
  scriptName?: string
  variant?: 'icon' | 'button'
  className?: string
}

export function CopyLoaderButton({
  slug,
  scriptName,
  variant = 'button',
  className,
}: CopyLoaderButtonProps) {
  const [copied, setCopied] = useState(false)
  const label = scriptName ? `Copy loader for ${scriptName}` : 'Copy loader'

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getLoaderSnippet(slug))
      setCopied(true)
      toast.success('Copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }

  const Icon = copied ? Check : Copy

  if (variant === 'icon') {
    return (
      <Tooltip text={copied ? 'Copied' : 'Copy Loader'}>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
            copied && 'text-emerald-400 hover:text-emerald-300',
            className
          )}
          aria-label={label}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      </Tooltip>
    )
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
        copied && 'border-emerald-800/60 text-emerald-300',
        className
      )}
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {copied ? 'Copied' : 'Copy Loader'}
    </button>
  )
}
