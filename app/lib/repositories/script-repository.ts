import { supabaseAdmin } from '@/app/lib/supabase'

export type ScriptRow = {
  id: string
  slug: string
  name: string
  description: string | null
  visibility: 'public' | 'private' | 'unlisted'
  access_mode: ScriptAccessMode
  creator_id: string | null
  current_version_id: string | null
  execute_count?: number | null
  last_executed_at?: string | null
  created_at: string
  updated_at: string
}

export type ScriptAccessMode = 'public' | 'key_required' | 'license_required'

export type DeliveryScriptRow = ScriptRow & {
  access_mode: ScriptAccessMode
}

const SCRIPT_SELECT = 'id, slug, name, description, visibility, access_mode, creator_id, current_version_id, execute_count, last_executed_at, created_at, updated_at'
const DELIVERY_SCRIPT_SELECT = SCRIPT_SELECT

export type VersionRow = {
  id: string
  script_id: string
  version: string
  content: string
  changelog: string | null
  created_at: string
}

export type VersionSummaryRow = Omit<VersionRow, 'content'>

export type DownloadRow = {
  id: string
  script_id: string
  version_id: string | null
  ip_hash: string
  user_agent_hash: string | null
  created_at: string
}

export type ScriptStats = {
  slug: string
  total_downloads: number
  unique_ips: number
  downloads_today: number
  downloads_this_week: number
  last_downloaded_at: string | null
}

export type ScriptAnalytics = {
  slug: string
  total_downloads: number
  downloads_today: number
  downloads_7d: number
  downloads_30d: number
  last_downloaded_at: string | null
}

export type CreatorAnalyticsOverview = {
  total_scripts: number
  published_scripts: number
  private_scripts: number
  total_downloads: number
  downloads_today: number
  downloads_7d: number
  downloads_30d: number
}

export type DownloadTrendPoint = {
  day: string
  downloads: number
}

export type DownloadTrendsResult = {
  points: DownloadTrendPoint[]
}

export type ListScriptsResult = {
  scripts: ScriptRow[]
  total: number
}

function getPepper(): string {
  return process.env.ANALYTICS_PEPPER || 'dev-pepper'
}

export async function hashIdentifier(value: string): Promise<string> {
  const pepper = getPepper()
  const data = new TextEncoder().encode(value + ':' + pepper)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function findScriptBySlug(slug: string): Promise<ScriptRow | null> {
  const { data, error } = await supabaseAdmin
    .from('scripts')
    .select(SCRIPT_SELECT)
    .eq('slug', slug)
    .single()

  if (error) return null
  return data
}

export async function findScriptForDeliveryBySlug(slug: string): Promise<DeliveryScriptRow | null> {
  const { data, error } = await supabaseAdmin
    .from('scripts')
    .select(DELIVERY_SCRIPT_SELECT)
    .eq('slug', slug)
    .single()

  if (error) return null
  return data as unknown as DeliveryScriptRow
}

export async function findScriptBySlugForOwner(slug: string, ownerId: string): Promise<ScriptRow | null> {
  const { data, error } = await supabaseAdmin
    .from('scripts')
    .select(SCRIPT_SELECT)
    .eq('slug', slug)
    .eq('creator_id', ownerId)
    .single()

  if (error) return null
  return data
}

export async function findScriptByIdForOwner(scriptId: string, ownerId: string): Promise<ScriptRow | null> {
  const { data, error } = await supabaseAdmin
    .from('scripts')
    .select(SCRIPT_SELECT)
    .eq('id', scriptId)
    .eq('creator_id', ownerId)
    .single()

  if (error) return null
  return data
}

export async function listScripts(
  visibility: string = 'public',
  limit: number = 20,
  offset: number = 0
): Promise<ListScriptsResult> {
  const query = supabaseAdmin
    .from('scripts')
    .select(SCRIPT_SELECT, { count: 'exact' })
    .eq('visibility', visibility)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) return { scripts: [], total: 0 }
  return { scripts: data ?? [], total: count ?? 0 }
}

export async function listScriptsForOwner(params: {
  ownerId: string
  visibility?: string | null
  search?: string | null
  limit?: number
  offset?: number
}): Promise<ListScriptsResult> {
  let query = supabaseAdmin
    .from('scripts')
    .select(SCRIPT_SELECT, { count: 'exact' })
    .eq('creator_id', params.ownerId)
    .order('updated_at', { ascending: false })

  if (params.visibility && params.visibility !== 'all') {
    query = query.eq('visibility', params.visibility)
  }

  if (params.search) {
    query = query.or(`name.ilike.*${params.search}*,slug.ilike.*${params.search}*`)
  }

  const limit = params.limit ?? 20
  const offset = params.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) return { scripts: [], total: 0 }
  return { scripts: data ?? [], total: count ?? 0 }
}

export async function createScript(params: {
  slug: string
  name: string
  description?: string
  visibility?: string
  access_mode?: ScriptAccessMode
  creator_id: string
}): Promise<ScriptRow> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('scripts')
    .insert({
      slug: params.slug,
      name: params.name,
      description: params.description ?? '',
      visibility: params.visibility ?? 'private',
      access_mode: params.access_mode ?? 'public',
      creator_id: params.creator_id,
      created_at: now,
      updated_at: now,
    })
    .select(SCRIPT_SELECT)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new ScriptConflictError(params.slug)
    }
    throw error
  }

  return data
}

export class ScriptConflictError extends Error {
  constructor(slug: string) {
    super(`A script with slug "${slug}" already exists`)
    this.name = 'ScriptConflictError'
  }
}

export async function updateScript(
  slug: string,
  params: {
    name?: string
    description?: string
    visibility?: 'public' | 'private' | 'unlisted'
    access_mode?: ScriptAccessMode
    current_version_id?: string
  },
  ownerId?: string
): Promise<ScriptRow | null> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (params.name !== undefined) updates.name = params.name
  if (params.description !== undefined) updates.description = params.description
  if (params.visibility !== undefined) updates.visibility = params.visibility
  if (params.access_mode !== undefined) updates.access_mode = params.access_mode
  if (params.current_version_id !== undefined) updates.current_version_id = params.current_version_id

  let query = supabaseAdmin
    .from('scripts')
    .update(updates)
    .eq('slug', slug)

  if (ownerId) {
    query = query.eq('creator_id', ownerId)
  }

  const { data, error } = await query
    .select(SCRIPT_SELECT)
    .single()

  if (error) return null
  return data
}

export async function deleteScript(slug: string, ownerId?: string): Promise<boolean> {
  let query = supabaseAdmin
    .from('scripts')
    .delete()
    .eq('slug', slug)

  if (ownerId) {
    query = query.eq('creator_id', ownerId)
  }

  const { error } = await query

  if (error) return false
  return true
}

export async function createVersion(params: {
  script_id: string
  version: string
  content: string
  changelog?: string
}): Promise<VersionRow> {
  const { data, error } = await supabaseAdmin
    .from('script_versions')
    .insert({
      script_id: params.script_id,
      version: params.version,
      content: params.content,
      changelog: params.changelog ?? null,
      created_at: new Date().toISOString(),
    })
    .select('id, script_id, version, content, changelog, created_at')
    .single()

  if (error) throw error
  return data
}

export async function getLatestVersion(scriptId: string): Promise<VersionRow | null> {
  const { data, error } = await supabaseAdmin
    .from('script_versions')
    .select('id, script_id, version, content, changelog, created_at')
    .eq('script_id', scriptId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}

export type VersionListResult = {
  versions: VersionSummaryRow[]
  total: number
}

export async function listVersionsForScript(scriptId: string, limit: number, offset: number): Promise<VersionListResult> {
  const { data, error, count } = await supabaseAdmin
    .from('script_versions')
    .select('id, script_id, version, changelog, created_at', { count: 'exact' })
    .eq('script_id', scriptId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { versions: [], total: 0 }
  return { versions: data ?? [], total: count ?? 0 }
}

export async function listVersionSummariesByIds(versionIds: string[]): Promise<VersionSummaryRow[]> {
  const uniqueVersionIds = Array.from(new Set(versionIds.filter(Boolean)))
  if (uniqueVersionIds.length === 0) return []

  const { data, error } = await supabaseAdmin
    .from('script_versions')
    .select('id, script_id, version, changelog, created_at')
    .in('id', uniqueVersionIds)

  if (error) return []
  return data ?? []
}

export async function getVersionById(versionId: string): Promise<VersionRow | null> {
  const { data, error } = await supabaseAdmin
    .from('script_versions')
    .select('id, script_id, version, content, changelog, created_at')
    .eq('id', versionId)
    .single()

  if (error) return null
  return data
}

export async function getScriptStats(slug: string): Promise<ScriptStats | null> {
  const script = await findScriptBySlug(slug)
  if (!script) return null

  const scriptId = script.id
  const today = new Date().toISOString().slice(0, 10)

  const { count: total, error: totalError } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('script_id', scriptId)

  const { count: todayCount, error: todayError } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('script_id', scriptId)
    .gte('created_at', today)

  const { data: uniqueData } = await supabaseAdmin
    .from('script_downloads')
    .select('ip_hash')
    .eq('script_id', scriptId)

  const uniqueIps = new Set((uniqueData ?? []).map((r) => r.ip_hash)).size

  const { data: lastData, error: lastError } = await supabaseAdmin
    .from('script_downloads')
    .select('created_at')
    .eq('script_id', scriptId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return {
    slug,
    total_downloads: totalError ? 0 : (total ?? 0),
    unique_ips: uniqueIps,
    downloads_today: todayError ? 0 : (todayCount ?? 0),
    downloads_this_week: 0,
    last_downloaded_at: lastError ? null : (lastData?.created_at ?? null),
  }
}

export async function getScriptStatsForOwner(slug: string, ownerId: string): Promise<ScriptStats | null> {
  const script = await findScriptBySlugForOwner(slug, ownerId)
  if (!script) return null

  return getScriptStatsForScript(script)
}

async function getScriptStatsForScript(script: ScriptRow): Promise<ScriptStats> {
  const scriptId = script.id
  const today = new Date().toISOString().slice(0, 10)

  const { count: total, error: totalError } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('script_id', scriptId)

  const { count: todayCount, error: todayError } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('script_id', scriptId)
    .gte('created_at', today)

  const { data: uniqueData } = await supabaseAdmin
    .from('script_downloads')
    .select('ip_hash')
    .eq('script_id', scriptId)

  const uniqueIps = new Set((uniqueData ?? []).map((r) => r.ip_hash)).size

  const { data: lastData, error: lastError } = await supabaseAdmin
    .from('script_downloads')
    .select('created_at')
    .eq('script_id', scriptId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return {
    slug: script.slug,
    total_downloads: totalError ? 0 : (total ?? 0),
    unique_ips: uniqueIps,
    downloads_today: todayError ? 0 : (todayCount ?? 0),
    downloads_this_week: 0,
    last_downloaded_at: lastError ? null : (lastData?.created_at ?? null),
  }
}

export async function recordDownload(params: {
  script_id: string
  version_id?: string | null
  ip_hash: string
  user_agent_hash?: string | null
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from('script_downloads').insert({
    script_id: params.script_id,
    version_id: params.version_id ?? null,
    ip_hash: params.ip_hash,
    user_agent_hash: params.user_agent_hash ?? null,
    created_at: new Date().toISOString(),
  })

  return !error
}

export async function getCreatorAnalyticsOverview(ownerId: string): Promise<CreatorAnalyticsOverview> {
  const scripts = await supabaseAdmin
    .from('scripts')
    .select('id, visibility')
    .eq('creator_id', ownerId)

  if (scripts.error || !scripts.data) {
    return {
      total_scripts: 0, published_scripts: 0, private_scripts: 0,
      total_downloads: 0, downloads_today: 0, downloads_7d: 0, downloads_30d: 0,
    }
  }

  const scriptIds = scripts.data.map((s) => s.id)
  const publishedCount = scripts.data.filter((s) => s.visibility === 'public').length
  const privateCount = scripts.data.filter((s) => s.visibility === 'private').length
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const days7 = new Date(now.getTime() - 7 * 86400000).toISOString()
  const days30 = new Date(now.getTime() - 30 * 86400000).toISOString()

  if (scriptIds.length === 0) {
    return {
      total_scripts: 0, published_scripts: 0, private_scripts: 0,
      total_downloads: 0, downloads_today: 0, downloads_7d: 0, downloads_30d: 0,
    }
  }

  const { count: total, error: totalErr } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .in('script_id', scriptIds)

  const { count: todayCount, error: todayErr } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .in('script_id', scriptIds)
    .gte('created_at', today)

  const { count: d7Count, error: d7Err } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .in('script_id', scriptIds)
    .gte('created_at', days7)

  const { count: d30Count, error: d30Err } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .in('script_id', scriptIds)
    .gte('created_at', days30)

  return {
    total_scripts: scripts.data.length,
    published_scripts: publishedCount,
    private_scripts: privateCount,
    total_downloads: totalErr ? 0 : (total ?? 0),
    downloads_today: todayErr ? 0 : (todayCount ?? 0),
    downloads_7d: d7Err ? 0 : (d7Count ?? 0),
    downloads_30d: d30Err ? 0 : (d30Count ?? 0),
  }
}

export async function getScriptAnalyticsForOwner(slug: string, ownerId: string): Promise<ScriptAnalytics | null> {
  const script = await findScriptBySlugForOwner(slug, ownerId)
  if (!script) return null

  const scriptId = script.id
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const days7 = new Date(now.getTime() - 7 * 86400000).toISOString()
  const days30 = new Date(now.getTime() - 30 * 86400000).toISOString()

  const { count: total, error: totalErr } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('script_id', scriptId)

  const { count: todayCount, error: todayErr } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('script_id', scriptId)
    .gte('created_at', today)

  const { count: d7Count, error: d7Err } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('script_id', scriptId)
    .gte('created_at', days7)

  const { count: d30Count, error: d30Err } = await supabaseAdmin
    .from('script_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('script_id', scriptId)
    .gte('created_at', days30)

  const { data: lastData } = await supabaseAdmin
    .from('script_downloads')
    .select('created_at')
    .eq('script_id', scriptId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return {
    slug,
    total_downloads: totalErr ? 0 : (total ?? 0),
    downloads_today: todayErr ? 0 : (todayCount ?? 0),
    downloads_7d: d7Err ? 0 : (d7Count ?? 0),
    downloads_30d: d30Err ? 0 : (d30Count ?? 0),
    last_downloaded_at: lastData?.created_at ?? null,
  }
}

export async function getDownloadTrendsForOwner(ownerId: string, rangeDays: 7 | 30): Promise<DownloadTrendsResult> {
  const scripts = await supabaseAdmin
    .from('scripts')
    .select('id')
    .eq('creator_id', ownerId)

  if (scripts.error || !scripts.data || scripts.data.length === 0) {
    return { points: [] }
  }

  const scriptIds = scripts.data.map((s) => s.id)
  const since = new Date(Date.now() - rangeDays * 86400000).toISOString().slice(0, 10)

  const { data, error } = await supabaseAdmin
    .from('script_downloads')
    .select('created_at')
    .in('script_id', scriptIds)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error || !data) {
    return { points: [] }
  }

  const dayMap = new Map<string, number>()
  for (const row of data) {
    const day = row.created_at.slice(0, 10)
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
  }

  const points: DownloadTrendPoint[] = []
  const start = new Date(since + 'T00:00:00Z')
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    const dayStr = d.toISOString().slice(0, 10)
    points.push({ day: dayStr, downloads: dayMap.get(dayStr) ?? 0 })
  }

  return { points }
}

export async function getScriptDownloadTrendsForOwner(
  slug: string,
  ownerId: string,
  rangeDays: 7 | 30
): Promise<DownloadTrendsResult | null> {
  const script = await findScriptBySlugForOwner(slug, ownerId)
  if (!script) return null

  const since = new Date(Date.now() - rangeDays * 86400000).toISOString().slice(0, 10)

  const { data, error } = await supabaseAdmin
    .from('script_downloads')
    .select('created_at')
    .eq('script_id', script.id)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error || !data) {
    return { points: [] }
  }

  const dayMap = new Map<string, number>()
  for (const row of data) {
    const day = row.created_at.slice(0, 10)
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
  }

  const points: DownloadTrendPoint[] = []
  const start = new Date(since + 'T00:00:00Z')
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    const dayStr = d.toISOString().slice(0, 10)
    points.push({ day: dayStr, downloads: dayMap.get(dayStr) ?? 0 })
  }

  return { points }
}
