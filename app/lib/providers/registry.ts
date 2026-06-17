import { workinkProvider } from '@/app/lib/providers/workink-provider'
import { listProviderRuntimeConfigs } from '@/app/lib/providers/config'
import type { KeyProvider, ProviderKey, ProviderMetadata } from '@/app/lib/providers/types'

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

export function resolveEnabledProvider(key: ProviderKey): KeyProvider | null {
  const provider = providers.get(key)

  if (!provider || !provider.metadata.enabled) {
    return null
  }

  return provider
}

export function listProviders(): KeyProvider[] {
  return [...providers.values()].sort(compareProviders)
}

export function listProviderMetadata(): ProviderMetadata[] {
  const adapterMetadata = new Map(
    [...providers.values()].map((provider) => [provider.key, provider.metadata])
  )

  return listProviderRuntimeConfigs().map((config) => adapterMetadata.get(config.key) ?? config)
}

export function listEnabledProviders(): KeyProvider[] {
  return listProviders().filter((provider) => provider.metadata.enabled)
}

export function listEnabledProviderMetadata(): ProviderMetadata[] {
  return listProviderMetadata().filter((metadata) => metadata.enabled)
}

function compareProviders(a: KeyProvider, b: KeyProvider) {
  return a.metadata.order - b.metadata.order || a.metadata.displayName.localeCompare(b.metadata.displayName)
}

registerProvider(workinkProvider)
