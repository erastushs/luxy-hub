import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { docsSections } from '@/app/docs/docs-data'

const ROOT = process.cwd()
const DOC_ROUTE_ALLOWLIST = new Set(['/docs'])
const registeredDocsRoutes = new Set(docsSections.map((section) => section.href))

function walkFiles(dir: string, extensions: Set<string>, result: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(fullPath, extensions, result)
    } else if (extensions.has(path.extname(entry.name))) {
      result.push(fullPath)
    }
  }
  return result
}

describe('docs link integrity', () => {
  it('does not reference the deprecated /docs/api navigation path', () => {
    const files = walkFiles(ROOT, new Set(['.ts', '.tsx', '.md']))
      .filter((file) => !file.includes(`${path.sep}docs${path.sep}archive${path.sep}`))

    const deprecatedRoute = '/docs' + '/api'
    const offenders = files
      .filter((file) => !file.endsWith(`${path.sep}docs-link-integrity.test.ts`))
      .filter((file) => fs.readFileSync(file, 'utf-8').includes(deprecatedRoute))

    expect(offenders).toEqual([])
  })

  it('resolves registered docs quick links and related sections', () => {
    const broken: string[] = []

    for (const section of docsSections) {
      for (const link of section.quickLinks) {
        if (link.href.startsWith('/docs') && !registeredDocsRoutes.has(link.href) && !DOC_ROUTE_ALLOWLIST.has(link.href)) {
          broken.push(`${section.href} quickLink ${link.href}`)
        }
      }

      for (const related of section.related) {
        if (!registeredDocsRoutes.has(`/docs/${related}`)) {
          broken.push(`${section.href} related ${related}`)
        }
      }
    }

    expect(broken).toEqual([])
  })
})
