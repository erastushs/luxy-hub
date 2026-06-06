'use client'

import { useState } from 'react'

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
      className="w-full rounded-lg bg-red-600 px-4 py-3 font-medium transition hover:bg-red-700"
    >
      {copied ? 'Copied!' : 'Copy Key'}
    </button>
  )
}
