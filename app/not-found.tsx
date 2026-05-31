import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="text-center">
        <h1 className="mb-4 text-7xl font-bold text-red-500">404</h1>

        <h2 className="mb-3 text-3xl font-semibold text-white">Page Not Found</h2>

        <p className="mb-8 max-w-md text-zinc-400">The page you are looking for does not exist or has been moved.</p>

        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-3 text-red-400 transition hover:bg-red-500/20"
        >
          Return Home
        </Link>
      </div>
    </main>
  )
}
