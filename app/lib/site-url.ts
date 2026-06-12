const DEFAULT_SITE_URL = 'https://www.luxyhub.space'

export function getSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (!configuredUrl) {
    return DEFAULT_SITE_URL
  }

  return new URL(configuredUrl).origin
}
