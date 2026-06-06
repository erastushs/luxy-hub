'use client'

export default function CopyKeyButton({ value }: { value: string }) {
  return (
    <button onClick={() => navigator.clipboard.writeText(value)} className="px-4 py-2 rounded-lg bg-red-600">
      Copy Key
    </button>
  )
}
