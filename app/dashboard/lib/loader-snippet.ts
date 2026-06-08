export const LOADER_BASE_URL = 'https://www.luxyhub.space'

export function getLoaderUrl(slug: string): string {
  return `${LOADER_BASE_URL}/api/loader/${slug}`
}

export function getLoaderSnippet(slug: string): string {
  return `loadstring(game:HttpGet("${getLoaderUrl(slug)}"))()`
}
