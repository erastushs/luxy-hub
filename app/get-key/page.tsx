import { KeyRound, Clock, Shield, ExternalLink, CheckCircle } from 'lucide-react'
import Navbar from '@/app/components/Navbar'
import Footer from '@/app/components/Footer'
import { getProviderRuntimeConfig } from '@/app/lib/providers/config'
import { listProviderMetadata } from '@/app/lib/providers/registry'
import type { ProviderMetadata } from '@/app/lib/providers/types'

export default function GetKeyPage() {
  const providers = listProviderMetadata()

  return (
    <>
      <Navbar keyPage />

      <main className="min-h-screen bg-zinc-950 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <div className="mb-12 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.25)]">
              <KeyRound className="h-8 w-8 text-red-400" />
            </div>

            <h1 className="mb-3 text-4xl font-bold sm:text-5xl">Get Your Free Key</h1>

            <p className="text-lg text-zinc-400">Complete one quick offer to unlock your LuxyHub access key.</p>
          </div>

          <div className="space-y-3">
            {providers.map((provider) => (
              <ProviderCard key={provider.key} provider={provider} />
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-zinc-600">
            Choose an available provider to complete a quick verification.
          </p>

          <div className="mt-10 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />

              <div>
                <p className="text-sm font-medium text-yellow-400">Key expires after 24 hours</p>

                <p className="mt-1 text-xs text-yellow-500/70">
                  You will need to complete a new offer to generate a fresh key once it expires.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <Shield className="mx-auto mb-2 h-5 w-5 text-zinc-500" />

              <p className="text-xs text-zinc-500">Secure & Encrypted</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <Clock className="mx-auto mb-2 h-5 w-5 text-zinc-500" />

              <p className="text-xs text-zinc-500">24-Hour Access Key</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <CheckCircle className="mx-auto mb-2 h-5 w-5 text-zinc-500" />

              <p className="text-xs text-zinc-500">One-Time Verification</p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
            <h2 className="mb-6 text-lg font-semibold">How it works</h2>

            <div className="space-y-5">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-sm font-bold text-red-400">
                  1
                </div>

                <div>
                  <p className="font-medium">Click Generate Key</p>

                  <p className="text-sm text-zinc-400">Choose an available provider above to open the verification flow in a new tab.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-sm font-bold text-red-400">
                  2
                </div>

                <div>
                  <p className="font-medium">Complete an offer</p>

                  <p className="text-sm text-zinc-400">
                    The provider will show you a short offer. Complete it to verify you are human.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-sm font-bold text-red-400">
                  3
                </div>

                <div>
                  <p className="font-medium">Get verified automatically</p>

                  <p className="text-sm text-zinc-400">
                    After completion, you will be redirected back with your key automatically generated.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}

function ProviderCard({ provider }: { provider: ProviderMetadata }) {
  const config = getProviderRuntimeConfig(provider.key)
  const href = provider.enabled ? config?.href : undefined

  if (!provider.enabled || !href) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 opacity-70">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-200">{provider.displayName}</h2>
              <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500">Coming soon</span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">{provider.description}</p>
            <p className="mt-2 text-xs text-zinc-600">{provider.estimatedTimeLabel}</p>
          </div>
          <button
            type="button"
            disabled
            className="rounded-xl border border-zinc-800 px-5 py-3 text-sm font-semibold text-zinc-600"
          >
            {provider.ctaLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-red-500/30 bg-red-600/10 p-5 transition-all hover:border-red-500/50 hover:bg-red-600/15 hover:shadow-[0_0_30px_rgba(239,68,68,0.25)] active:scale-[0.99]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{provider.displayName}</h2>
          <p className="mt-1 text-sm text-zinc-400">{provider.description}</p>
          <p className="mt-2 text-xs text-red-300/80">{provider.estimatedTimeLabel}</p>
        </div>
        <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition group-hover:bg-red-500">
          <ExternalLink className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          {provider.ctaLabel}
        </span>
      </div>
    </a>
  )
}
