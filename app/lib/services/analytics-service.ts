import { supabaseAdmin } from '@/app/lib/supabase'
import { getTopScripts as getTopScriptsRepo, type TopScript } from '@/app/lib/repositories/script-execution-repository'
import { findScriptBySlugForOwner } from '@/app/lib/repositories/script-repository'

export type CreatorAnalyticsOverviewType = {
  total_scripts: number
  published_scripts: number
  private_scripts: number
  unlisted_scripts: number
  total_executions: number
}

export type ScriptAnalyticsType = {
  slug: string
  total_executions: number
  last_executed_at: string | null
}

export type { TopScript }

export type OverviewResult =
  | { success: true; overview: CreatorAnalyticsOverviewType }
  | { success: false; message: string; status: number }

export type ScriptAnalyticsResult =
  | { success: true; analytics: ScriptAnalyticsType }
  | { success: false; message: string; status: number }

export async function getOverview(ownerId: string): Promise<OverviewResult> {
  try {
    const { data, error } = await supabaseAdmin
      .from('scripts')
      .select('visibility, execute_count')
      .eq('creator_id', ownerId)

    if (error || !data) {
      return {
        success: true,
        overview: {
          total_scripts: 0,
          published_scripts: 0,
          private_scripts: 0,
          unlisted_scripts: 0,
          total_executions: 0,
        },
      }
    }

    return {
      success: true,
      overview: {
        total_scripts: data.length,
        published_scripts: data.filter((script) => script.visibility === 'public').length,
        private_scripts: data.filter((script) => script.visibility === 'private').length,
        unlisted_scripts: data.filter((script) => script.visibility === 'unlisted').length,
        total_executions: data.reduce((sum, script) => sum + Number(script.execute_count ?? 0), 0),
      },
    }
  } catch {
    return { success: false, message: 'Failed to fetch analytics overview', status: 500 }
  }
}

export async function getScriptStats(ownerId: string, slug: string): Promise<ScriptAnalyticsResult> {
  try {
    const script = await findScriptBySlugForOwner(slug, ownerId)
    if (!script) {
      return { success: false, message: 'Script not found', status: 404 }
    }

    return {
      success: true,
      analytics: {
        slug,
        total_executions: Number(script.execute_count ?? 0),
        last_executed_at: script.last_executed_at ?? null,
      },
    }
  } catch {
    return { success: false, message: 'Failed to fetch script analytics', status: 500 }
  }
}

export async function getTopScripts(ownerId: string, limit: number = 5): Promise<TopScript[]> {
  try {
    return await getTopScriptsRepo(ownerId, limit)
  } catch {
    return []
  }
}
