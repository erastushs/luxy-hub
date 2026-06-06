'use client'

import { useState } from 'react'

export default function KeyGenerator() {
  const [loading, setLoading] = useState(false)
  const [key, setKey] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  async function generateKey() {
    try {
      setLoading(true)

      const res = await fetch('/api/generate-key', {
        method: 'POST',
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error()
      }

      setKey(data.key)
      setExpiresAt(data.expires_at)
    } catch {
      alert('Failed to generate key')
    } finally {
      setLoading(false)
    }
  }

  async function copyKey() {
    await navigator.clipboard.writeText(key)
    alert('Key copied!')
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={generateKey} disabled={loading} className="rounded-lg bg-red-600 px-4 py-3 font-semibold">
        {loading ? 'Generating...' : 'Generate Key'}
      </button>

      {key && (
        <div className="rounded-lg border p-4">
          <p className="font-mono break-all">{key}</p>

          <p className="mt-2 text-sm opacity-70">Expires: {new Date(expiresAt).toLocaleString()}</p>

          <button onClick={copyKey} className="mt-4 rounded-lg border px-3 py-2">
            Copy Key
          </button>
        </div>
      )}
    </div>
  )
}
