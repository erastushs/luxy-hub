import path from 'path'
import { docsSections } from '@/app/docs/docs-data'

const DOCS_ROOT = path.join(process.cwd(), 'docs')
const PROJECT_ROOT = process.cwd()

const fileRouteMap = new Map<string, string>()

function normalizePath(p: string) {
  try {
    return path.resolve(p)
  } catch {
    return p
  }
}

for (const section of docsSections) {
  for (const sourcePath of section.sourcePaths) {
    const abs = normalizePath(sourcePath)
    if (!fileRouteMap.has(abs)) {
      fileRouteMap.set(abs, section.href)
    }
  }
}

export function resolveDocLinks(markdown: string, sourceDir: string): string {
  const pattern = /`([a-zA-Z0-9_/.-]+\.md)`/g

  return markdown.replace(pattern, (match, relativePath: string) => {
    if (relativePath.includes('://') || relativePath.startsWith('http')) {
      return match
    }

    const candidates = [
      normalizePath(path.resolve(sourceDir, relativePath)),
      normalizePath(path.resolve(DOCS_ROOT, relativePath)),
      normalizePath(path.resolve(PROJECT_ROOT, relativePath)),
    ]

    for (const candidate of candidates) {
      const route = fileRouteMap.get(candidate)
      if (route) {
        const displayPath = relativePath.replace(/^(\.\.\/)+/, '')
        return `[\`${displayPath}\`](${route})`
      }
    }

    return match
  })
}
