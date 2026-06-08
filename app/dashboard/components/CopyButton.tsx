'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

type CopyButtonProps = {
  value: string
  label?: string
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
      title={label ? `Copy ${label}` : 'Copy'}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? 'Copied' : label ?? 'Copy'}
    </button>
  )
}
