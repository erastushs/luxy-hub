import type { ProviderKey, ProviderMetadata } from '@/app/lib/providers/types'

const WORKINK_URL = 'https://work.ink/2Dlr/luxyhub'

type ProviderRuntimeConfig = ProviderMetadata & {
  href?: string
}

const providerDefaults: Record<string, ProviderRuntimeConfig> = {
  workink: {
    key: 'workink',
    displayName: 'Work.ink',
    description: 'Complete a short verification offer to receive a 24-hour LuxyHub key.',
    enabled: true,
    order: 10,
    ctaLabel: 'Generate Key via Work.ink',
    estimatedTimeLabel: 'Usually 30-60 seconds',
    href: WORKINK_URL,
  },
  linkvertise: {
    key: 'linkvertise',
    displayName: 'Linkvertise',
    description: 'Planned provider support for future key generation flows.',
    enabled: false,
    order: 20,
    ctaLabel: 'Coming Soon',
    estimatedTimeLabel: 'Not available yet',
  },
  lootlabs: {
    key: 'lootlabs',
    displayName: 'LootLabs',
    description: 'Planned provider support for future key generation flows.',
    enabled: false,
    order: 30,
    ctaLabel: 'Coming Soon',
    estimatedTimeLabel: 'Not available yet',
  },
}

export function getProviderRuntimeConfig(key: ProviderKey): ProviderRuntimeConfig | null {
  const defaults = providerDefaults[key]
  if (!defaults) return null

  return {
    ...defaults,
    enabled: readEnabled(key, defaults.enabled),
    href: readHref(key, defaults.href),
  }
}

export function listProviderRuntimeConfigs(): ProviderRuntimeConfig[] {
  return Object.keys(providerDefaults)
    .map((key) => getProviderRuntimeConfig(key))
    .filter((config): config is ProviderRuntimeConfig => config !== null)
    .sort((a, b) => a.order - b.order || a.displayName.localeCompare(b.displayName))
}

function readEnabled(key: ProviderKey, fallback: boolean): boolean {
  const envName = `KEY_PROVIDER_${key.toUpperCase()}_ENABLED`
  const value = process.env[envName]

  if (value === undefined) return fallback
  return value === 'true' || value === '1'
}

function readHref(key: ProviderKey, fallback?: string): string | undefined {
  const envName = `KEY_PROVIDER_${key.toUpperCase()}_URL`

  return process.env[envName] || fallback
}
