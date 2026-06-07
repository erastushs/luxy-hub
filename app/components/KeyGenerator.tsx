'use client'

import { useState } from 'react'

export default function KeyGenerator() {
  const [loading, setLoading] = useState(false)
  const [key, setKey] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [token, setToken] = useState('')

  async function generateKey() {
    if (!token.trim()) {
      alert('Please enter a Work.ink verification token')
      return
    }

    try {
      setLoading(true)

      const res = await fetch('/api/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })

      const data = await res.json()

      if (!data.success) {
        alert(data.message || 'Failed to generate key')
        return
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
      <input
        type="text"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Enter Work.ink verification token"
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white"
      />

      <button
        onClick={generateKey}
        disabled={loading}
        className="rounded-lg bg-red-600 px-4 py-3 font-semibold"
      >
        {loading ? 'Generating...' : 'Generate Key'}
      </button>

      {key && (
        <div className="rounded-lg border p-4">
          <p className="font-mono break-all">{key}</p>
          <p className="mt-2 text-sm opacity-70">
            Expires: {new Date(expiresAt).toLocaleString()}
          </p>
          <button onClick={copyKey} className="mt-4 rounded-lg border px-3 py-2">
            Copy Key
          </button>
        </div>
      )}
    </div>
  )
}
