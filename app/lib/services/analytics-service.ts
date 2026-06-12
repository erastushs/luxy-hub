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

export type AnalyticsV2OverviewType = CreatorAnalyticsOverviewType & {
  window_days: number
  authorization: {
    success: number
    failure: number
    denial_reasons: Record<string, number>
  }
  licenses: {
    active: number
    revoked: number
    disabled: number
    assignment_utilization: number
  }
  delivery: {
    session_creation: number
    payload_fetch: number | null
    fetch_failures: number | null
  }
  runtime: {
    starts: number
    failures: number
    execution_volume: number
  }
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

export type AnalyticsV2OverviewResult =
  | { success: true; overview: AnalyticsV2OverviewType }
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

export async function getAnalyticsV2Overview(
  ownerId: string,
  options: { windowDays?: number } = {}
): Promise<AnalyticsV2OverviewResult> {
  const overview = await getOverview(ownerId)
  if (!overview.success) return overview

  const windowDays = normalizeWindowDays(options.windowDays)
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  const [licenses, authorization, delivery, runtime] = await Promise.all([
    getLicenseMetrics(ownerId),
    getAuthorizationMetrics(ownerId, since),
    getDeliveryMetrics(ownerId, since),
    getRuntimeMetrics(ownerId, overview.overview.total_executions, since),
  ])

  return {
    success: true,
    overview: {
      ...overview.overview,
      window_days: windowDays,
      authorization,
      licenses,
      delivery,
      runtime,
    },
  }
}

function normalizeWindowDays(windowDays: number | undefined): number {
  if (!windowDays || !Number.isFinite(windowDays)) return 30
  if (windowDays <= 1) return 1
  if (windowDays <= 7) return 7
  if (windowDays <= 30) return 30
  return 90
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

async function getLicenseMetrics(ownerId: string): Promise<AnalyticsV2OverviewType['licenses']> {
  try {
    const { data, error } = await supabaseAdmin
      .from('licenses')
      .select('status, max_assignments')
      .eq('creator_id', ownerId)

    if (error || !data) throw error

    const licenseIds = (data as Array<{ status: string; max_assignments: number }>).length
    const totalCapacity = data.reduce((sum, license) => sum + Number(license.max_assignments ?? 0), 0)
    const activeAssignments = await getActiveAssignmentCount(ownerId)

    return {
      active: data.filter((license) => license.status === 'active').length,
      revoked: data.filter((license) => license.status === 'revoked').length,
      disabled: data.filter((license) => license.status === 'disabled').length,
      assignment_utilization: licenseIds === 0 || totalCapacity <= 0
        ? 0
        : Math.min(1, activeAssignments / totalCapacity),
    }
  } catch {
    return { active: 0, revoked: 0, disabled: 0, assignment_utilization: 0 }
  }
}

async function getActiveAssignmentCount(ownerId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('licenses')
    .select('id, license_assignments(status)')
    .eq('creator_id', ownerId)

  if (error || !data) return 0

  return data.reduce((sum, license) => {
    const assignments = Array.isArray(license.license_assignments) ? license.license_assignments : []
    return sum + assignments.filter((assignment) => assignment.status === 'active').length
  }, 0)
}

async function getAuthorizationMetrics(ownerId: string, since: string): Promise<AnalyticsV2OverviewType['authorization']> {
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('action, metadata')
      .eq('actor_id', ownerId)
      .in('action', ['license.authorization_allowed', 'license.authorization_denied'])
      .gte('created_at', since)

    if (error || !data) throw error

    const denialReasons: Record<string, number> = {}
    let success = 0
    let failure = 0

    for (const row of data as Array<{ action: string; metadata: Record<string, unknown> | null }>) {
      if (row.action === 'license.authorization_allowed') {
        success += 1
      } else {
        failure += 1
        const reason = typeof row.metadata?.reason === 'string' ? row.metadata.reason : 'unknown'
        denialReasons[reason] = (denialReasons[reason] ?? 0) + 1
      }
    }

    return { success, failure, denial_reasons: denialReasons }
  } catch {
    return { success: 0, failure: 0, denial_reasons: {} }
  }
}

async function getDeliveryMetrics(ownerId: string, since: string): Promise<AnalyticsV2OverviewType['delivery']> {
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('action')
      .eq('actor_id', ownerId)
      .eq('action', 'delivery.session_created')
      .gte('created_at', since)

    if (error || !data) throw error

    return {
      session_creation: data.length,
      payload_fetch: null,
      fetch_failures: null,
    }
  } catch {
    return { session_creation: 0, payload_fetch: null, fetch_failures: null }
  }
}

async function getRuntimeMetrics(
  ownerId: string,
  executionVolume: number,
  since: string
): Promise<AnalyticsV2OverviewType['runtime']> {
  try {
    const { data: scripts, error: scriptsError } = await supabaseAdmin
      .from('scripts')
      .select('id')
      .eq('creator_id', ownerId)

    if (scriptsError || !scripts) throw scriptsError

    const scriptIds = scripts.map((script) => script.id).filter(Boolean)
    if (scriptIds.length === 0) {
      return { starts: 0, failures: 0, execution_volume: executionVolume }
    }

    const { data, error } = await supabaseAdmin
      .from('event_logs')
      .select('event_type, delivery_status')
      .in('script_id', scriptIds)
      .in('event_type', ['execute', 'error', 'heartbeat'])
      .gte('received_at', since)

    if (error || !data) throw error

    return {
      starts: data.filter((event) => event.event_type === 'execute' || event.event_type === 'heartbeat').length,
      failures: data.filter((event) => event.event_type === 'error' || event.delivery_status === 'dead_letter').length,
      execution_volume: executionVolume,
    }
  } catch {
    return { starts: 0, failures: 0, execution_volume: executionVolume }
  }
}
