import { DEFAULT_SITE_URL } from '@/app/config/platform'

export const isProduction = process.env.NODE_ENV === 'production'

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.length > 0 ? value : undefined
}

export function getRequiredEnv(name: string): string {
  const value = getOptionalEnv(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getPublicSiteUrl(): string {
  const configuredUrl = getOptionalEnv('NEXT_PUBLIC_SITE_URL')
  return configuredUrl ? new URL(configuredUrl).origin : DEFAULT_SITE_URL
}

export function getPublicSupabaseUrl(): string {
  return getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL')
}

export function getPublicSupabaseAnonKey(): string {
  return getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export function getSupabaseServiceRoleKey(): string {
  return getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
}

export function getCronSecret(): string | undefined {
  return getOptionalEnv('CRON_SECRET')
}

export function getAdminApiKey(): string | undefined {
  return getOptionalEnv('ADMIN_API_KEY')
}

export function getAnalyticsPepper(): string {
  return getOptionalEnv('ANALYTICS_PEPPER') ?? 'dev-pepper'
}

export function getKeyHashSecret(): string {
  const secret = getOptionalEnv('KEY_HASH_SECRET') ?? getOptionalEnv('ANALYTICS_PEPPER')
  if (secret) return secret

  if (isProduction) {
    throw new Error('KEY_HASH_SECRET is required in production')
  }

  return 'dev-key-hash-secret'
}

export function getLicenseHashSecret(): string {
  const secret = getOptionalEnv('LICENSE_HASH_SECRET') ?? getOptionalEnv('ANALYTICS_PEPPER')
  if (secret) return secret

  if (isProduction) {
    throw new Error('LICENSE_HASH_SECRET is required in production')
  }

  return 'dev-license-hash-secret'
}

export function getTurnstileSecretKey(): string | undefined {
  return getOptionalEnv('TURNSTILE_SECRET_KEY')
}

export function getTurnstileSiteKey(): string | undefined {
  return getOptionalEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY')
}

export function getDeliveryPayloadSecret(): string | undefined {
  return getOptionalEnv('DELIVERY_PAYLOAD_SECRET')
}

export function getDeliveryPayloadSecretOrDevDefault(): string {
  const secret = getDeliveryPayloadSecret()
  if (secret) return secret

  if (isProduction) {
    throw new Error('Payload secret is not configured')
  }

  return 'dev-delivery-payload-secret'
}

export function getDeliveryPayloadKeyId(): string {
  return getOptionalEnv('DELIVERY_PAYLOAD_KEY_ID') ?? 'default'
}

export function getInternalAlertDiscordWebhook(): string | undefined {
  return getOptionalEnv('INTERNAL_ALERT_DISCORD_WEBHOOK')
}
