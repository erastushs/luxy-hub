import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LoaderSnippetCard } from '@/app/dashboard/components/LoaderSnippetCard'
import { ScriptMetadataSummaryCard } from '@/app/dashboard/components/ScriptMetadataSummaryCard'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import { DEFAULT_SITE_URL } from '@/app/config/platform'
import { getPublicSiteUrl } from '@/app/config/env'

async function loadLoaderSnippetModule() {
  vi.resetModules()
  return import('@/app/dashboard/lib/loader-snippet')
}

describe('Dashboard UX polish components', () => {
  it('generates environment loader URLs and snippets from the script slug', async () => {
    const { getLoaderSnippet, getLoaderUrl } = await loadLoaderSnippetModule()
    const expectedOrigin = getPublicSiteUrl()

    expect(getLoaderUrl('test123')).toBe(`${expectedOrigin}/api/loader/test123`)
    expect(getLoaderSnippet('test123')).toBe(
      `loadstring(game:HttpGet("${expectedOrigin}/api/loader/test123"))()`
    )
  })

  it.each([
    ['develop', 'https://www.luxyhub.dev'],
    ['production', 'https://www.luxyhub.space'],
  ])('supports %s site URL configuration', async (_environment, siteUrl) => {
    const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = siteUrl

    try {
      const { getLoaderSnippet, getLoaderUrl } = await loadLoaderSnippetModule()
      expect(getPublicSiteUrl()).toBe(siteUrl)
      expect(getLoaderUrl('test123')).toBe(`${siteUrl}/api/loader/test123`)
      expect(getLoaderSnippet('test123')).toBe(
        `loadstring(game:HttpGet("${siteUrl}/api/loader/test123"))()`
      )
    } finally {
      if (originalSiteUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
      }
      vi.resetModules()
    }
  })

  it('renders tooltip text for icon-only actions', () => {
    const html = renderToStaticMarkup(
      <Tooltip text="Copy Loader">
        <button type="button" aria-label="Copy loader">Icon</button>
      </Tooltip>
    )

    expect(html).toContain('role="tooltip"')
    expect(html).toContain('Copy Loader')
    expect(html).toContain('aria-label="Copy loader"')
  })

  it('renders loader snippet card with URL, snippet, and copy controls', () => {
    const expectedOrigin = getPublicSiteUrl()
    const html = renderToStaticMarkup(<LoaderSnippetCard slug="test123" />)

    expect(html).toContain(`${expectedOrigin}/api/loader/test123`)
    expect(html).toContain(`loadstring(game:HttpGet(&quot;${expectedOrigin}/api/loader/test123&quot;))()`)
    expect(html).toContain('Copy Loader')
    expect(html).toContain('Copy URL')
    expect(html).toContain('Copy Snippet')
  })

  it('groups current slug, loader URL, build status, and version in one summary', () => {
    const html = renderToStaticMarkup(
      <ScriptMetadataSummaryCard
        slug="test123"
        currentVersion={{
          id: 'version-uuid-1',
          script_id: 'script-uuid-1',
          version: '1.0.0',
          changelog: null,
          created_at: '2026-01-01T00:00:00.000Z',
        }}
        buildInfo={{
          buildId: 'build-uuid-1',
          scriptId: 'script-uuid-1',
          versionId: 'version-uuid-1',
          status: 'ready',
          buildVersion: 'delivery-build-v1',
          payloadFormatVersion: 'inline-json-v1',
          invalidatedReason: null,
          errorCode: null,
          errorMessage: null,
          lastBuildAt: '2026-01-01T00:01:00.000Z',
          invalidatedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:01:00.000Z',
        }}
      />
    )

    expect(html).toContain('Current Slug')
    expect(html).toContain('/test123')
    expect(html).toContain('Current Version')
    expect(html).toContain('v1.0.0')
    expect(html).toContain('Build Status')
    expect(html).toContain('Ready')
    expect(html).toContain('Loader URL')
  })

  it('defaults to configured develop site URL when env is unset', () => {
    expect(DEFAULT_SITE_URL).toBe('https://www.luxyhub.dev')
  })
})
