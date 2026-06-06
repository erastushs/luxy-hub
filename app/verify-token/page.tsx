import CopyKeyButton from '@/app/components/CopyKeyButton'

export default async function VerifyTokenPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams

  if (!token) {
    return <main className="p-10">No token found</main>
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
      <main className="min-h-screen flex items-center justify-center">
        <div>
          <h1>Invalid Token</h1>
          <p>{data.message}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-xl w-full space-y-6">
        <h1 className="text-4xl font-bold">Your Key</h1>

        <div className="border rounded-lg p-4">
          <code>{data.key}</code>
        </div>

        <CopyKeyButton value={data.key} />

        <p>Expires: {new Date(data.expires_at).toLocaleString()}</p>
      </div>
    </main>
  )
}
