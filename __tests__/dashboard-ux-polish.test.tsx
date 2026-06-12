import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LoaderSnippetCard } from '@/app/dashboard/components/LoaderSnippetCard'
import { ScriptMetadataSummaryCard } from '@/app/dashboard/components/ScriptMetadataSummaryCard'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import { getLoaderSnippet, getLoaderUrl } from '@/app/dashboard/lib/loader-snippet'

const expectedOrigin = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
  : 'https://www.luxyhub.space'

describe('Dashboard UX polish components', () => {
  it('generates environment loader URLs and snippets from the script slug', () => {
    expect(getLoaderUrl('test123')).toBe(`${expectedOrigin}/api/loader/test123`)
    expect(getLoaderSnippet('test123')).toBe(
      `loadstring(game:HttpGet("${expectedOrigin}/api/loader/test123"))()`
    )
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
})
