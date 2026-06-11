import { supabaseAdmin } from '@/app/lib/supabase'

export type ScriptAccessMode = 'public' | 'key_required' | 'license_required'

export type LicenseStatus = 'active' | 'disabled' | 'revoked'

export type LicenseRow = {
  id: string
  script_id: string
  creator_id: string
  key_hash: string
  max_assignments: number
  status: LicenseStatus
  activation_count: number
  delivery_count: number
  last_activation_at: string | null
  last_delivery_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type LicenseAssignmentRow = {
  id: string
  license_id: string
  customer_identifier_hash: string
  display_name: string | null
  status: LicenseStatus
  created_at: string
  updated_at: string
}

export type CreateLicenseParams = {
  scriptId: string
  creatorId: string
  keyHash: string
  maxAssignments?: number
  status?: LicenseStatus
  expiresAt?: string | null
}

export type CreateLicenseAssignmentParams = {
  licenseId: string
  customerIdentifierHash: string
  displayName?: string | null
  status?: LicenseStatus
}

const LICENSE_SELECT = [
  'id',
  'script_id',
  'creator_id',
  'key_hash',
  'max_assignments',
  'status',
  'activation_count',
  'delivery_count',
  'last_activation_at',
  'last_delivery_at',
  'expires_at',
  'created_at',
  'updated_at',
].join(', ')

const LICENSE_ASSIGNMENT_SELECT = [
  'id',
  'license_id',
  'customer_identifier_hash',
  'display_name',
  'status',
  'created_at',
  'updated_at',
].join(', ')

export async function createLicense(params: CreateLicenseParams): Promise<LicenseRow> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('licenses')
    .insert({
      script_id: params.scriptId,
      creator_id: params.creatorId,
      key_hash: params.keyHash,
      max_assignments: params.maxAssignments ?? 1,
      status: params.status ?? 'active',
      expires_at: params.expiresAt ?? null,
      created_at: now,
      updated_at: now,
    })
    .select(LICENSE_SELECT)
    .single()

  if (error) throw error
  return data as unknown as LicenseRow
}

export async function getLicenseById(id: string): Promise<LicenseRow | null> {
  const { data, error } = await supabaseAdmin
    .from('licenses')
    .select(LICENSE_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as LicenseRow | null
}

export async function getLicenseForScriptByKeyHash(
  scriptId: string,
  keyHash: string
): Promise<LicenseRow | null> {
  const { data, error } = await supabaseAdmin
    .from('licenses')
    .select(LICENSE_SELECT)
    .eq('script_id', scriptId)
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error) throw error
  return data as unknown as LicenseRow | null
}

export async function getLicensesForScript(scriptId: string): Promise<LicenseRow[]> {
  const { data, error } = await supabaseAdmin
    .from('licenses')
    .select(LICENSE_SELECT)
    .eq('script_id', scriptId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as unknown as LicenseRow[]) ?? []
}

export async function revokeLicense(id: string): Promise<LicenseRow | null> {
  return updateLicenseStatus(id, 'revoked')
}

export async function disableLicense(id: string): Promise<LicenseRow | null> {
  return updateLicenseStatus(id, 'disabled')
}

export async function enableLicense(id: string): Promise<LicenseRow | null> {
  return updateLicenseStatus(id, 'active')
}

async function updateLicenseStatus(id: string, status: LicenseStatus): Promise<LicenseRow | null> {
  const { data, error } = await supabaseAdmin
    .from('licenses')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(LICENSE_SELECT)
    .maybeSingle()

  if (error) throw error
  return data as unknown as LicenseRow | null
}

export async function createLicenseAssignment(
  params: CreateLicenseAssignmentParams
): Promise<LicenseAssignmentRow> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('license_assignments')
    .insert({
      license_id: params.licenseId,
      customer_identifier_hash: params.customerIdentifierHash,
      display_name: params.displayName ?? null,
      status: params.status ?? 'active',
      created_at: now,
      updated_at: now,
    })
    .select(LICENSE_ASSIGNMENT_SELECT)
    .single()

  if (error) throw error
  return data as unknown as LicenseAssignmentRow
}

export async function getLicenseAssignments(licenseId: string): Promise<LicenseAssignmentRow[]> {
  const { data, error } = await supabaseAdmin
    .from('license_assignments')
    .select(LICENSE_ASSIGNMENT_SELECT)
    .eq('license_id', licenseId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as unknown as LicenseAssignmentRow[]) ?? []
}

export async function getLicenseAssignmentByCustomerHash(
  licenseId: string,
  customerIdentifierHash: string
): Promise<LicenseAssignmentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('license_assignments')
    .select(LICENSE_ASSIGNMENT_SELECT)
    .eq('license_id', licenseId)
    .eq('customer_identifier_hash', customerIdentifierHash)
    .maybeSingle()

  if (error) throw error
  return data as unknown as LicenseAssignmentRow | null
}

export async function removeLicenseAssignment(id: string): Promise<LicenseAssignmentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('license_assignments')
    .delete()
    .eq('id', id)
    .select(LICENSE_ASSIGNMENT_SELECT)
    .maybeSingle()

  if (error) throw error
  return data as unknown as LicenseAssignmentRow | null
}
