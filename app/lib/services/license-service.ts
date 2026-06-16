import { randomBytes } from 'node:crypto'
import {
  authorizeLicenseAssignment,
  createLicense as createLicenseRow,
  disableLicense as disableLicenseRow,
  enableLicense as enableLicenseRow,
  getLicenseAssignmentByCustomerHash,
  getLicenseAssignments,
  getLicenseById,
  getLicenseForScriptByKeyHash,
  getLicensesForScript as getLicenseRowsForScript,
  incrementLicenseDeliveryCount,
  removeLicenseAssignment,
  revokeLicense as revokeLicenseRow,
  updateLicenseKeyHashes,
  type LicenseAssignmentRow,
  type LicenseRow,
} from '@/app/lib/repositories/license-repository'
import { logAuditEvent } from '@/app/lib/services/audit-service'
import { licenseConfig } from '@/app/config/licenses'
import {
  hashCustomerIdentifier,
  hashLicenseLookup,
  hashLicenseVerifier,
  isLegacyLicenseVerifier,
  legacyLicenseVerifier,
  verifyLicenseVerifier,
} from '@/app/lib/security/secret-hashing'

const LICENSE_KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export type CreateLicenseInput = {
  script_id: string
  creator_id: string
  max_assignments?: number
  expires_at?: string | null
}

export type CreateLicenseResult = {
  license: LicenseRow
  raw_key: string
}

export type CreateAssignmentInput = {
  license_id: string
  customer_identifier: string
  display_name?: string | null
}

export type ValidateLicenseResult =
  | { success: true; license: LicenseRow; assignment: LicenseAssignmentRow; assignmentCreated: boolean }
  | { success: false; status: number; message: string; reason: LicenseValidationFailureReason }

export type LicenseValidationFailureReason =
  | 'license_required'
  | 'customer_identifier_required'
  | 'invalid_license'
  | 'invalid_assignment'
  | 'capacity_exhausted'

export const CUSTOMER_IDENTIFIER_MIN_LENGTH = licenseConfig.customerIdentifierMinLength
export const CUSTOMER_IDENTIFIER_MAX_LENGTH = licenseConfig.customerIdentifierMaxLength

function randomLicenseSegment(length: number): string {
  const bytes = randomBytes(length)
  let segment = ''
  for (const byte of bytes) {
    segment += LICENSE_KEY_ALPHABET[byte % LICENSE_KEY_ALPHABET.length]
  }
  return segment
}

export function generateRawLicenseKey(): string {
  return `LUXY-PREM-${randomLicenseSegment(4)}-${randomLicenseSegment(4)}-${randomLicenseSegment(4)}`
}

export function hashLicenseSecret(value: string): string {
  return hashLicenseLookup(value)
}

export function normalizeCustomerIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase()
  if (
    normalized.length < CUSTOMER_IDENTIFIER_MIN_LENGTH
    || normalized.length > CUSTOMER_IDENTIFIER_MAX_LENGTH
  ) {
    return null
  }
  return normalized
}

export async function createLicense(input: CreateLicenseInput): Promise<CreateLicenseResult> {
  const rawKey = generateRawLicenseKey()
  const license = await createLicenseRow({
    scriptId: input.script_id,
    creatorId: input.creator_id,
    keyHash: hashLicenseVerifier(rawKey),
    keyLookupHash: hashLicenseLookup(rawKey),
    maxAssignments: input.max_assignments,
    expiresAt: input.expires_at ?? null,
  })

  logAuditEvent({
    actor_id: input.creator_id,
    actor_role: 'creator',
    action: 'license.created',
    resource_type: 'license',
    resource_id: license.id,
    metadata: {
      script_id: input.script_id,
      max_assignments: license.max_assignments,
      expires_at: license.expires_at,
    },
  })

  return { license, raw_key: rawKey }
}

export function getLicense(id: string): Promise<LicenseRow | null> {
  return getLicenseById(id)
}

export async function getOwnedLicense(id: string, ownerId: string): Promise<LicenseRow | null> {
  const license = await getLicenseById(id)
  if (!license || license.creator_id !== ownerId) return null
  return license
}

export function getLicensesForScript(scriptId: string): Promise<LicenseRow[]> {
  return getLicenseRowsForScript(scriptId)
}

export async function validateLicense({
  scriptId,
  license,
  customerIdentifier,
}: {
  scriptId: string
  license: unknown
  customerIdentifier?: unknown
}): Promise<ValidateLicenseResult> {
  if (typeof license !== 'string' || license.trim().length === 0) {
    return { success: false, status: 403, message: 'License is required', reason: 'license_required' }
  }

  const rawLicense = license.trim()
  const normalizedCustomerIdentifier = normalizeCustomerIdentifier(customerIdentifier)
  if (!normalizedCustomerIdentifier) {
    return {
    success: false,
    status: 403,
    message: 'Customer identifier is required',
    reason: 'customer_identifier_required',
  }
  }

  const lookupHash = hashLicenseLookup(rawLicense)
  const legacyLookupHash = legacyLicenseVerifier(rawLicense)
  const licenseRow = await getLicenseForScriptByKeyHash(scriptId, lookupHash)
    ?? await getLicenseForScriptByKeyHash(scriptId, legacyLookupHash)

  if (!licenseRow || !verifyLicenseVerifier(rawLicense, licenseRow.key_hash) || licenseRow.status !== 'active') {
    if (licenseRow) logRuntimeLicenseAudit(licenseRow, null, 'license.authorization_denied', 'invalid_license')
    return { success: false, status: 403, message: 'Invalid license', reason: 'invalid_license' }
  }

  if (isLegacyLicenseVerifier(licenseRow.key_hash) || licenseRow.key_lookup_hash !== lookupHash) {
    await updateLicenseKeyHashes(licenseRow.id, {
      keyHash: hashLicenseVerifier(rawLicense),
      keyLookupHash: lookupHash,
    })
  }

  if (licenseRow.expires_at && new Date(licenseRow.expires_at).getTime() <= Date.now()) {
    logRuntimeLicenseAudit(licenseRow, null, 'license.authorization_denied', 'expired_license')
    return { success: false, status: 403, message: 'Invalid license', reason: 'invalid_license' }
  }

  const customerIdentifierHash = hashCustomerIdentifier(normalizedCustomerIdentifier)
  const legacyCustomerIdentifierHash = legacyLicenseVerifier(normalizedCustomerIdentifier)
  const existingAssignment = await getLicenseAssignmentByCustomerHash(licenseRow.id, customerIdentifierHash)
    ?? await getLicenseAssignmentByCustomerHash(licenseRow.id, legacyCustomerIdentifierHash)

  if (existingAssignment) {
    if (existingAssignment.status !== 'active') {
      logRuntimeLicenseAudit(licenseRow, existingAssignment, 'license.authorization_denied', 'invalid_assignment')
      return { success: false, status: 403, message: 'Invalid license assignment', reason: 'invalid_assignment' }
    }
    logRuntimeLicenseAudit(licenseRow, existingAssignment, 'license.authorization_allowed', 'assignment_reused')
    return { success: true, license: licenseRow, assignment: existingAssignment, assignmentCreated: false }
  }

  const authorization = await authorizeLicenseAssignment({
    licenseId: licenseRow.id,
      customerIdentifierHash,
    displayName: null,
  })

  if (!authorization.success) {
    const reason = authorization.reason === 'invalid_assignment' ? 'invalid_assignment' : 'capacity_exhausted'
    logRuntimeLicenseAudit(licenseRow, null, 'license.authorization_denied', reason)
    return reason === 'invalid_assignment'
      ? { success: false, status: 403, message: 'Invalid license assignment', reason }
      : { success: false, status: 403, message: 'License assignment capacity exceeded', reason }
  }

  if (authorization.assignment.status !== 'active') {
    logRuntimeLicenseAudit(licenseRow, authorization.assignment, 'license.authorization_denied', 'invalid_assignment')
    return { success: false, status: 403, message: 'Invalid license assignment', reason: 'invalid_assignment' }
  }

  if (authorization.created) {
    logRuntimeLicenseAudit(licenseRow, authorization.assignment, 'license.assignment_created', 'runtime_assignment_created')
  }

  logRuntimeLicenseAudit(licenseRow, authorization.assignment, 'license.authorization_allowed', 'assignment_created')

  return {
    success: true,
    license: licenseRow,
    assignment: authorization.assignment,
    assignmentCreated: authorization.created,
  }
}

export function recordLicenseDelivery(licenseId: string): Promise<void> {
  return incrementLicenseDeliveryCount(licenseId)
}

export async function revokeLicense(id: string): Promise<LicenseRow | null> {
  const license = await getLicenseById(id)
  if (!license || license.status !== 'active') return license
  const updated = await revokeLicenseRow(id)
  if (updated) logLicenseLifecycleAudit(updated, 'license.revoked')
  return updated
}

export async function disableLicense(id: string): Promise<LicenseRow | null> {
  const license = await getLicenseById(id)
  if (!license || license.status !== 'active') return license
  const updated = await disableLicenseRow(id)
  if (updated) logLicenseLifecycleAudit(updated, 'license.disabled')
  return updated
}

export async function enableLicense(id: string): Promise<LicenseRow | null> {
  const license = await getLicenseById(id)
  if (!license || license.status !== 'disabled') return license
  const updated = await enableLicenseRow(id)
  if (updated) logLicenseLifecycleAudit(updated, 'license.enabled')
  return updated
}

export function getAssignments(licenseId: string): Promise<LicenseAssignmentRow[]> {
  return getLicenseAssignments(licenseId)
}

export function removeAssignment(id: string): Promise<LicenseAssignmentRow | null> {
  return removeLicenseAssignment(id)
}

export async function createAssignment(input: CreateAssignmentInput): Promise<LicenseAssignmentRow> {
  const normalizedCustomerIdentifier = normalizeCustomerIdentifier(input.customer_identifier)
  if (!normalizedCustomerIdentifier) {
    throw new Error('Customer identifier is required')
  }

  const license = await getLicenseById(input.license_id)
  if (!license) {
    throw new Error('License not found')
  }

  const authorization = await authorizeLicenseAssignment({
    licenseId: input.license_id,
      customerIdentifierHash: hashCustomerIdentifier(normalizedCustomerIdentifier),
    displayName: input.display_name ?? null,
  })

  if (!authorization.success) {
    throw new Error(
      authorization.reason === 'invalid_assignment'
        ? 'Invalid license assignment'
        : 'License assignment capacity exceeded'
    )
  }

  const assignment = authorization.assignment

  logAuditEvent({
    actor_id: license.creator_id,
    actor_role: 'creator',
    action: 'license.assignment_created',
    resource_type: 'license_assignment',
    resource_id: assignment.id,
    metadata: {
      license_id: license.id,
      customer_identifier_hash: assignment.customer_identifier_hash,
    },
  })

  return assignment
}

function logLicenseLifecycleAudit(
  license: LicenseRow,
  action: 'license.disabled' | 'license.enabled' | 'license.revoked'
): void {
  logAuditEvent({
    actor_id: license.creator_id,
    actor_role: 'creator',
    action,
    resource_type: 'license',
    resource_id: license.id,
    metadata: {
      script_id: license.script_id,
      status: license.status,
    },
  })
}

function logRuntimeLicenseAudit(
  license: LicenseRow,
  assignment: LicenseAssignmentRow | null,
  action: 'license.authorization_allowed' | 'license.authorization_denied' | 'license.assignment_created',
  reason: string
): void {
  logAuditEvent({
    actor_id: license.creator_id,
    actor_role: 'runtime',
    action,
    resource_type: assignment ? 'license_assignment' : 'license',
    resource_id: assignment?.id ?? license.id,
    metadata: {
      script_id: license.script_id,
      license_id: license.id,
      assignment_id: assignment?.id ?? null,
      customer_identifier_hash: assignment?.customer_identifier_hash ?? null,
      reason,
    },
  })
}
