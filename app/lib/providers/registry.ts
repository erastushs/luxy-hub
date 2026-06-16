import { workinkProvider } from '@/app/lib/providers/workink-provider'
import type { KeyProvider, ProviderKey } from '@/app/lib/providers/types'

const providers = new Map<ProviderKey, KeyProvider>()

export function registerProvider(provider: KeyProvider): void {
  providers.set(provider.key, provider)
}

export function getProvider(key: ProviderKey): KeyProvider {
  const provider = providers.get(key)

  if (!provider) {
    throw new Error(`Unknown key provider: ${key}`)
  }

  return provider
}

export function listProviders(): KeyProvider[] {
  return [...providers.values()]
}

registerProvider(workinkProvider)
