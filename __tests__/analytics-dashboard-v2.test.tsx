import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/app/lib/auth/session-auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/app/lib/services/analytics-service', () => ({
  getAnalyticsV2Overview: vi.fn(),
  getTopScripts: vi.fn(),
}))

import AnalyticsPage from '@/app/dashboard/analytics/page'
import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getAnalyticsV2Overview, getTopScripts } from '@/app/lib/services/analytics-service'

const mockedGetCurrentUser = vi.mocked(getCurrentUser)
const mockedGetAnalyticsV2Overview = vi.mocked(getAnalyticsV2Overview)
const mockedGetTopScripts = vi.mocked(getTopScripts)

describe('Analytics V2 dashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedGetCurrentUser.mockResolvedValue({ id: 'creator-uuid-1', email: 'creator@example.test' })
    mockedGetTopScripts.mockResolvedValue([])
    mockedGetAnalyticsV2Overview.mockResolvedValue({
      success: true,
      overview: {
        total_scripts: 3,
        published_scripts: 1,
        private_scripts: 1,
        unlisted_scripts: 1,
        total_executions: 42,
        window_days: 7,
        authorization: {
          success: 8,
          failure: 2,
          denial_reasons: { capacity_exhausted: 2 },
        },
        licenses: {
          active: 4,
          disabled: 1,
          revoked: 1,
          assignment_utilization: 0.5,
        },
        runtime: {
          starts: 12,
          failures: 1,
          execution_volume: 42,
        },
        delivery: {
          session_creation: 9,
          payload_fetch: null,
          fetch_failures: null,
        },
      },
    })
  })

  it('renders V2 sections and passes the selected window to the service', async () => {
    const page = await AnalyticsPage({
      searchParams: Promise.resolve({ window: '7' }),
    })
    const html = renderToStaticMarkup(page)

    expect(mockedGetAnalyticsV2Overview).toHaveBeenCalledWith('creator-uuid-1', { windowDays: 7 })
    expect(html).toContain('Analytics V2')
    expect(html).toContain('Authorization')
    expect(html).toContain('Licenses')
    expect(html).toContain('Runtime')
    expect(html).toContain('Delivery')
    expect(html).toContain('capacity exhausted')
    expect(html).toContain('Unavailable')
  })
})
