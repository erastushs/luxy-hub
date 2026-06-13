import { KeyRound, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import CopyKeyButton from '@/app/components/CopyKeyButton'
import { getClientIPFromHeaders } from '@/app/lib/rate-limiter'
import { generateVerifiedFreeKey } from '@/app/lib/services/free-key-generation-service'
import Navbar from '@/app/components/Navbar'
import Footer from '@/app/components/Footer'
import { headers } from 'next/headers'

type TokenStatus = {
  success: boolean
  message: string
  key?: string
  expires_at?: string
}

export default async function VerifyTokenPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <>
        <Navbar keyPage />
        <main className="min-h-screen bg-zinc-950 px-4 py-24">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10">
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>

            <h1 className="mb-3 text-3xl font-bold">No Token Found</h1>

            <p className="mb-8 text-zinc-400">
              No verification token was provided. Please go through the Work.ink flow to
              get a key.
            </p>

            <a
              href="/get-key"
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-semibold transition hover:bg-red-500"
            >
              <ArrowLeft className="h-4 w-4" />
              Go to Get Key
            </a>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  let status: TokenStatus
  const headersList = await headers()
  const clientIP = getClientIPFromHeaders(headersList)

  try {
    const result = await generateVerifiedFreeKey(token, clientIP, 'verify-token page')
    if (result.success) {
      status = {
        success: true,
        message: 'Key generated successfully',
        key: result.key,
        expires_at: result.expires_at,
      }
    } else {
      status = { success: false, message: result.message }
    }
  } catch {
    status = { success: false, message: 'Verification service unavailable' }
  }

  if (!status.success) {
    const isAlreadyUsed = status.message === 'Token already used'

    return (
      <>
        <Navbar keyPage />
        <main className="min-h-screen bg-zinc-950 px-4 py-24">
          <div className="mx-auto max-w-md text-center">
            <div
              className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border ${
                isAlreadyUsed
                  ? 'border-yellow-500/30 bg-yellow-500/10'
                  : 'border-red-500/30 bg-red-500/10'
              }`}
            >
              <AlertTriangle
                className={`h-8 w-8 ${isAlreadyUsed ? 'text-yellow-400' : 'text-red-400'}`}
              />
            </div>

            <h1 className="mb-3 text-3xl font-bold">
              {isAlreadyUsed ? 'Token Already Used' : 'Invalid Token'}
            </h1>

            <p className="mb-4 text-zinc-400">
              {isAlreadyUsed
                ? 'This verification token has already been redeemed. Each offer can only be used once.'
                : 'This token is invalid or expired. Please complete a new Work.ink offer to receive a valid key.'}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/get-key"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-semibold transition hover:bg-red-500"
              >
                <RefreshCw className="h-4 w-4" />
                Generate New Key
              </a>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar keyPage />
      <main className="min-h-screen bg-zinc-950 px-4 py-24">
        <div className="mx-auto max-w-xl">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
              <KeyRound className="h-8 w-8 text-green-400" />
            </div>

            <h1 className="mb-3 text-3xl font-bold">Your Key is Ready</h1>

            <p className="mb-10 text-zinc-400">
              Copy your key and paste it into the LuxyHub script to get started.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Your Access Key
            </p>

            <div className="mb-6 rounded-xl border border-zinc-700 bg-black p-4">
              <code className="break-all text-lg font-medium text-green-400">
                {status.key}
              </code>
            </div>

            <CopyKeyButton value={status.key!} />

            {status.expires_at && (
              <p className="mt-6 text-center text-sm text-zinc-500">
                Expires on{' '}
                {new Date(status.expires_at).toLocaleString('en-US', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </p>
            )}
          </div>

          <div className="mt-8 rounded-xl border border-zinc-800 p-4 text-center">
            <p className="text-sm text-zinc-500">
              Need help?{' '}
              <a
                href="https://discord.gg/Gr5UQUKp7"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-400 underline underline-offset-2 hover:text-red-300"
              >
                Join our Discord
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
