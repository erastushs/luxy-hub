import Link from 'next/link'

export default function GetKeyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-bold">Get Your Free Key</h1>

        <p className="text-gray-400">Complete one offer through Work.ink to unlock your LuxyHub key.</p>

        <Link
          href="https://work.ink/2Dlr/luxyhub"
          className="inline-block px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition"
        >
          Generate Key
        </Link>
      </div>
    </main>
  )
}
