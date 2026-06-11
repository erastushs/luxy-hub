import { createHash, randomBytes } from 'node:crypto'
import {
  createLicense as createLicenseRow,
  createLicenseAssignment,
  disableLicense as disableLicenseRow,
  enableLicense as enableLicenseRow,
  getLicenseAssignments,
  getLicenseById,
  getLicensesForScript as getLicenseRowsForScript,
  removeLicenseAssignment,
  revokeLicense as revokeLicenseRow,
  type LicenseAssignmentRow,
  type LicenseRow,
} from '@/app/lib/repositories/license-repository'

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
  return createHash('sha256').update(value).digest('hex')
}

export async function createLicense(input: CreateLicenseInput): Promise<CreateLicenseResult> {
  const rawKey = generateRawLicenseKey()
  const license = await createLicenseRow({
    scriptId: input.script_id,
    creatorId: input.creator_id,
    keyHash: hashLicenseSecret(rawKey),
    maxAssignments: input.max_assignments,
    expiresAt: input.expires_at ?? null,
  })

  return { license, raw_key: rawKey }
}

export function getLicense(id: string): Promise<LicenseRow | null> {
  return getLicenseById(id)
}

export function getLicensesForScript(scriptId: string): Promise<LicenseRow[]> {
  return getLicenseRowsForScript(scriptId)
}

export async function revokeLicense(id: string): Promise<LicenseRow | null> {
  const license = await getLicenseById(id)
  if (!license || license.status !== 'active') return license
  return revokeLicenseRow(id)
}

export async function disableLicense(id: string): Promise<LicenseRow | null> {
  const license = await getLicenseById(id)
  if (!license || license.status !== 'active') return license
  return disableLicenseRow(id)
}

export async function enableLicense(id: string): Promise<LicenseRow | null> {
  const license = await getLicenseById(id)
  if (!license || license.status !== 'disabled') return license
  return enableLicenseRow(id)
}

export function getAssignments(licenseId: string): Promise<LicenseAssignmentRow[]> {
  return getLicenseAssignments(licenseId)
}

export function removeAssignment(id: string): Promise<LicenseAssignmentRow | null> {
  return removeLicenseAssignment(id)
}

export function createAssignment(input: CreateAssignmentInput): Promise<LicenseAssignmentRow> {
  return createLicenseAssignment({
    licenseId: input.license_id,
    customerIdentifierHash: hashLicenseSecret(input.customer_identifier),
    displayName: input.display_name ?? null,
  })
}
