import { supabaseAdmin } from '@/app/lib/supabase'

export type ScriptExecutionRow = {
  id: string
  script_id: string
  session_id: string
  created_at: string
}

export type TopScript = {
  name: string
  slug: string
  visibility: 'public' | 'private' | 'unlisted'
  executions: number
  last_executed_at: string | null
}

const SCRIPT_EXECUTION_SELECT = [
  'id',
  'script_id',
  'session_id',
  'created_at',
].join(', ')

export async function recordExecution(params: {
  scriptId: string
  sessionId: string
}): Promise<ScriptExecutionRow> {
  const { data, error } = await supabaseAdmin
    .from('script_executions')
    .insert({
      script_id: params.scriptId,
      session_id: params.sessionId,
      created_at: new Date().toISOString(),
    })
    .select(SCRIPT_EXECUTION_SELECT)
    .single()

  if (error) throw error
  return data as unknown as ScriptExecutionRow
}

export async function getScriptExecuteCount(scriptId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('scripts')
    .select('execute_count')
    .eq('id', scriptId)
    .maybeSingle()

  if (error || !data) return 0

  const count = Number(data.execute_count)
  return Number.isFinite(count) ? count : 0
}

export async function getTopScripts(ownerId: string, limit: number = 5): Promise<TopScript[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const { data, error } = await supabaseAdmin
    .from('scripts')
    .select('name, slug, visibility, execute_count, last_executed_at')
    .eq('creator_id', ownerId)
    .order('execute_count', { ascending: false })
    .order('last_executed_at', { ascending: false, nullsFirst: false })
    .limit(safeLimit)

  if (error || !data) return []

  return data.map((script) => ({
    name: script.name,
    slug: script.slug,
    visibility: script.visibility,
    executions: Number(script.execute_count ?? 0),
    last_executed_at: script.last_executed_at ?? null,
  })) as TopScript[]
}
