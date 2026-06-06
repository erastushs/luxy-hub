import CopyKeyButton from '@/app/components/CopyKeyButton'
import Navbar from '@/app/components/Navbar'
import Footer from '@/app/components/Footer'

export default async function VerifyTokenPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams

  if (!token) {
    return (
      <>
        <Navbar />
        <main className="p-10">No token found</main>
        <Footer />
      </>
    )
  }

  const response = await fetch('http://localhost:3000/api/verify-workink', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
    }),
    cache: 'no-store',
  })

  const data = await response.json()

  if (!data.success) {
    return (
      <>
        <Navbar keyPage />
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="mb-4 text-3xl font-bold text-red-500">Invalid Token</h1>

            <p className="mb-6 text-zinc-400">This token is invalid, expired, or already used.</p>

            <a href="/get-key" className="inline-block rounded-lg bg-red-600 px-6 py-3">
              Generate New Key
            </a>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <h1 className="mb-2 text-3xl font-bold">Key Generated</h1>

          <p className="mb-6 text-zinc-400">Your LuxyHub key has been generated successfully.</p>

          <div className="mb-4 rounded-lg border border-zinc-700 bg-black p-4">
            <code className="break-all text-green-400">{data.key}</code>
          </div>

          <CopyKeyButton value={data.key} />

          <div className="mt-6 text-sm text-zinc-500">Expires: {new Date(data.expires_at).toLocaleString()}</div>
        </div>
      </main>
      <Footer />
    </>
  )
}
