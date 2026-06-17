import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/app/actions/scripts', () => ({
  updateScriptAction: vi.fn(),
}))

vi.mock('@/app/actions/builds', () => ({
  rebuildLatestBuildAction: vi.fn(),
}))

vi.mock('@/app/actions/auth', () => ({
  logout: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/scripts/my-script/edit',
}))

import { LoaderSnippetCard } from '@/app/dashboard/components/LoaderSnippetCard'
import { ScriptForm } from '@/app/dashboard/components/ScriptForm'
import { ScriptMetadataSummaryCard } from '@/app/dashboard/components/ScriptMetadataSummaryCard'
import { Tooltip } from '@/app/dashboard/components/Tooltip'
import EditScriptClient from '@/app/dashboard/scripts/[slug]/edit/edit-client'
import { getLoaderSnippet, getLoaderUrl } from '@/app/dashboard/lib/loader-snippet'

describe('Dashboard UX polish components', () => {
  it('generates production loader URLs and snippets from the script slug', () => {
    expect(getLoaderUrl('test123')).toBe('https://www.luxyhub.space/api/loader/test123')
    expect(getLoaderSnippet('test123')).toBe(
      'loadstring(game:HttpGet("https://www.luxyhub.space/api/loader/test123"))()'
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

    expect(html).toContain('https://www.luxyhub.space/api/loader/test123')
    expect(html).toContain('loadstring(game:HttpGet(&quot;https://www.luxyhub.space/api/loader/test123&quot;))()')
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

  it('renders access mode selector in the shared script form', () => {
    const html = renderToStaticMarkup(
      <ScriptForm
        initial={{ name: 'My Script', slug: 'my-script', access_mode: 'key_required' }}
        submitLabel="Save"
        onSubmit={async () => {}}
      />
    )

    expect(html).toContain('Access Mode')
    expect(html).toContain('value="public"')
    expect(html).toContain('value="key_required"')
  })

  it('renders current access mode in the edit form', () => {
    const html = renderToStaticMarkup(
      <EditScriptClient
        script={{
          id: 'script-uuid-1',
          slug: 'my-script',
          name: 'My Script',
          description: null,
          visibility: 'private',
          access_mode: 'key_required',
          creator_id: 'creator-uuid-1',
          current_version_id: null,
          created_at: '2026-06-17T00:00:00.000Z',
          updated_at: '2026-06-17T00:00:00.000Z',
        }}
        currentVersion={null}
        buildInfo={null}
        lastUploadedFilename={null}
      />
    )

    expect(html).toContain('Access Mode')
    expect(html).toContain('value="key_required" selected=""')
  })
})
