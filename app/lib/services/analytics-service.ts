import {
  getCreatorAnalyticsOverview,
  getScriptAnalyticsForOwner,
  getDownloadTrendsForOwner,
  getScriptDownloadTrendsForOwner,
  type CreatorAnalyticsOverview as CreatorAnalyticsOverviewType,
  type ScriptAnalytics as ScriptAnalyticsType,
  type DownloadTrendsResult as DownloadTrendsResultType,
} from '@/app/lib/repositories/script-repository'

export type {
  CreatorAnalyticsOverviewType,
  ScriptAnalyticsType,
  DownloadTrendsResultType,
}

export type OverviewResult =
  | { success: true; overview: CreatorAnalyticsOverviewType }
  | { success: false; message: string; status: number }

export type ScriptAnalyticsResult =
  | { success: true; analytics: ScriptAnalyticsType }
  | { success: false; message: string; status: number }

export type DownloadTrendsResult =
  | { success: true; trends: DownloadTrendsResultType }
  | { success: false; message: string; status: number }

function parseRangeDays(range: string | null): 7 | 30 | null {
  if (range === '7' || range === '7d' || range === 'last_7_days') return 7
  if (range === '30' || range === '30d' || range === 'last_30_days') return 30
  return null
}

export async function getOverview(ownerId: string): Promise<OverviewResult> {
  try {
    const overview = await getCreatorAnalyticsOverview(ownerId)
    return { success: true, overview }
  } catch {
    return { success: false, message: 'Failed to fetch analytics overview', status: 500 }
  }
}

export async function getScriptStats(ownerId: string, slug: string): Promise<ScriptAnalyticsResult> {
  try {
    const stats = await getScriptAnalyticsForOwner(slug, ownerId)
    if (!stats) {
      return { success: false, message: 'Script not found', status: 404 }
    }
    return { success: true, analytics: stats }
  } catch {
    return { success: false, message: 'Failed to fetch script analytics', status: 500 }
  }
}

export async function getDownloadTrends(
  ownerId: string,
  range: string | null,
  slug?: string | null
): Promise<DownloadTrendsResult> {
  const rangeDays = parseRangeDays(range)
  if (rangeDays === null) {
    return { success: false, message: 'Range must be last_7_days or last_30_days', status: 400 }
  }

  try {
    if (slug) {
      const result = await getScriptDownloadTrendsForOwner(slug, ownerId, rangeDays)
      if (!result) {
        return { success: false, message: 'Script not found', status: 404 }
      }
      return { success: true, trends: result }
    }

    const result = await getDownloadTrendsForOwner(ownerId, rangeDays)
    return { success: true, trends: result }
  } catch {
    return { success: false, message: 'Failed to fetch download trends', status: 500 }
  }
}
