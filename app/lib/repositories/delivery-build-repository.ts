import { supabaseAdmin } from '@/app/lib/supabase'

export type DeliveryBuildStatus = 'pending' | 'building' | 'ready' | 'failed' | 'invalidated'

export type DeliveryBuildRow = {
  id: string
  script_id: string
  version_id: string
  build_status: DeliveryBuildStatus
  payload_storage_kind: 'inline_encrypted'
  payload_ciphertext: string | null
  payload_content_type: string
  payload_byte_size: number | null
  source_sha256: string
  payload_sha256: string | null
  build_version: string
  payload_format_version: string
  encryption_scheme: string
  encryption_key_id: string | null
  invalidated_reason: string | null
  build_error_code: string | null
  build_error_message: string | null
  metadata: Record<string, unknown>
  built_at: string | null
  invalidated_at: string | null
  created_at: string
  updated_at: string
}

export type CreateBuildParams = {
  scriptId: string
  versionId: string
  sourceSha256: string
  buildVersion: string
  payloadFormatVersion: string
  encryptionScheme: string
  encryptionKeyId?: string | null
  payloadContentType: string
  metadata?: Record<string, unknown>
}

export type ReadyBuildParams = {
  buildVersion?: string
  payloadFormatVersion?: string
}

const BUILD_SELECT = [
  'id',
  'script_id',
  'version_id',
  'build_status',
  'payload_storage_kind',
  'payload_ciphertext',
  'payload_content_type',
  'payload_byte_size',
  'source_sha256',
  'payload_sha256',
  'build_version',
  'payload_format_version',
  'encryption_scheme',
  'encryption_key_id',
  'invalidated_reason',
  'build_error_code',
  'build_error_message',
  'metadata',
  'built_at',
  'invalidated_at',
  'created_at',
  'updated_at',
].join(', ')

const EXCLUDED_METADATA_KEYS = new Set([
  'content',
  'source',
  'raw_source',
  'script_content',
  'plaintext',
  'payload_plaintext',
  'secret',
  'key',
  'token',
  'authorization',
])

function sanitizeBuildMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const key of Object.keys(metadata)) {
    if (EXCLUDED_METADATA_KEYS.has(key.toLowerCase())) continue

    const value = metadata[key]
    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, 256)
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[key] = value
    }
  }

  return sanitized
}

function sanitizeBuildText(value: string): string {
  return value.replace(/[\r\n\t]/g, ' ').slice(0, 256)
}

export async function createBuild(params: CreateBuildParams): Promise<DeliveryBuildRow> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('delivery_builds')
    .insert({
      script_id: params.scriptId,
      version_id: params.versionId,
      build_status: 'building',
      payload_storage_kind: 'inline_encrypted',
      payload_ciphertext: null,
      payload_content_type: params.payloadContentType,
      payload_byte_size: null,
      source_sha256: params.sourceSha256,
      payload_sha256: null,
      build_version: params.buildVersion,
      payload_format_version: params.payloadFormatVersion,
      encryption_scheme: params.encryptionScheme,
      encryption_key_id: params.encryptionKeyId ?? null,
      metadata: sanitizeBuildMetadata(params.metadata ?? {}),
      created_at: now,
      updated_at: now,
    })
    .select(BUILD_SELECT)
    .single()

  if (error) throw error
  return data as unknown as DeliveryBuildRow
}

export async function getBuildByVersion(versionId: string): Promise<DeliveryBuildRow | null> {
  const { data, error } = await supabaseAdmin
    .from('delivery_builds')
    .select(BUILD_SELECT)
    .eq('version_id', versionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data as unknown as DeliveryBuildRow
}

export async function getBuildById(buildId: string): Promise<DeliveryBuildRow | null> {
  const { data, error } = await supabaseAdmin
    .from('delivery_builds')
    .select(BUILD_SELECT)
    .eq('id', buildId)
    .single()

  if (error) return null
  return data as unknown as DeliveryBuildRow
}

export async function getReadyBuild(
  versionId: string,
  params: ReadyBuildParams = {}
): Promise<DeliveryBuildRow | null> {
  let query = supabaseAdmin
    .from('delivery_builds')
    .select(BUILD_SELECT)
    .eq('version_id', versionId)
    .eq('build_status', 'ready')
    .eq('payload_storage_kind', 'inline_encrypted')

  if (params.buildVersion) {
    query = query.eq('build_version', params.buildVersion)
  }

  if (params.payloadFormatVersion) {
    query = query.eq('payload_format_version', params.payloadFormatVersion)
  }

  const { data, error } = await query
    .order('built_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data as unknown as DeliveryBuildRow
}

export async function markBuildReady(
  buildId: string,
  params: {
    payloadCiphertext: string
    payloadSha256: string
    payloadByteSize: number
  }
): Promise<DeliveryBuildRow> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('delivery_builds')
    .update({
      build_status: 'ready',
      payload_ciphertext: params.payloadCiphertext,
      payload_sha256: params.payloadSha256,
      payload_byte_size: params.payloadByteSize,
      build_error_code: null,
      build_error_message: null,
      built_at: now,
      updated_at: now,
    })
    .eq('id', buildId)
    .select(BUILD_SELECT)
    .single()

  if (error) throw error
  return data as unknown as DeliveryBuildRow
}

export async function markBuildFailed(
  buildId: string,
  params: {
    errorCode: string
    errorMessage: string
  }
): Promise<DeliveryBuildRow> {
  const { data, error } = await supabaseAdmin
    .from('delivery_builds')
    .update({
      build_status: 'failed',
      payload_ciphertext: null,
      payload_sha256: null,
      payload_byte_size: null,
      build_error_code: sanitizeBuildText(params.errorCode),
      build_error_message: sanitizeBuildText(params.errorMessage),
      updated_at: new Date().toISOString(),
    })
    .eq('id', buildId)
    .select(BUILD_SELECT)
    .single()

  if (error) throw error
  return data as unknown as DeliveryBuildRow
}

export async function markBuildInvalidated(
  buildId: string,
  reason: string
): Promise<DeliveryBuildRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('delivery_builds')
    .update({
      build_status: 'invalidated',
      invalidated_reason: sanitizeBuildText(reason),
      invalidated_at: now,
      updated_at: now,
    })
    .eq('id', buildId)
    .select(BUILD_SELECT)
    .single()

  if (error) return null
  return data as unknown as DeliveryBuildRow
}
