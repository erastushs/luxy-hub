import { getSiteUrl } from '@/app/lib/site-url'

export const LOADER_BASE_URL = getSiteUrl()

export function getLoaderUrl(slug: string): string {
  return `${LOADER_BASE_URL}/api/loader/${slug}`
}

export function getLoaderSnippet(slug: string): string {
  return `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`
}
