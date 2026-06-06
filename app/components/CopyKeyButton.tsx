'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyKeyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)

    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-all active:scale-[0.98] ${
        copied
          ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]'
          : 'bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]'
      }`}
    >
      {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
      {copied ? 'Copied to Clipboard' : 'Copy Key'}
    </button>
  )
}
