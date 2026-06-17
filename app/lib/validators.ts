import { MAX_SCRIPT_REQUEST_BODY_BYTES, MAX_SCRIPT_SIZE_BYTES } from '@/app/lib/constants/size-limits'

const KEY_REGEX = /^LUXY-(?:[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|FREE-[A-Z0-9]{4}-[A-Z0-9]{4}|PREM-[A-Z0-9]{4}-[A-Z0-9]{4})$/
const MAX_TOKEN_LENGTH = 256
const MAX_BODY_SIZE = MAX_SCRIPT_REQUEST_BODY_BYTES

export function isValidKeyFormat(key: unknown): key is string {
  return typeof key === 'string' && KEY_REGEX.test(key)
}

export function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && token.trim().length > 0 && token.length <= MAX_TOKEN_LENGTH
}

export function validateRequestSize(contentLength: string | null): boolean {
  if (!contentLength) return true
  const size = parseInt(contentLength, 10)
  return !isNaN(size) && size <= MAX_BODY_SIZE
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/
const MAX_SLUG_LENGTH = 64
const MAX_NAME_LENGTH = 100
const MAX_CONTENT_LENGTH = MAX_SCRIPT_SIZE_BYTES
const MAX_DISPLAY_NAME_LENGTH = 80
export const VALID_VISIBILITIES = ['public', 'private', 'unlisted'] as const
export type Visibility = (typeof VALID_VISIBILITIES)[number]
export const VALID_DASHBOARD_ACCESS_MODES = ['public', 'key_required'] as const
export type DashboardAccessMode = (typeof VALID_DASHBOARD_ACCESS_MODES)[number]
export const VALID_PROFILE_ROLES = ['creator', 'admin'] as const
export type ProfileRole = (typeof VALID_PROFILE_ROLES)[number]

export function isValidSlug(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 3 &&
    value.length <= MAX_SLUG_LENGTH &&
    SLUG_REGEX.test(value)
  )
}

export function isValidScriptName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_NAME_LENGTH
}

export function isValidVisibility(value: unknown): value is Visibility {
  return typeof value === 'string' && VALID_VISIBILITIES.includes(value as Visibility)
}

export function isValidDashboardAccessMode(value: unknown): value is DashboardAccessMode {
  return typeof value === 'string' && VALID_DASHBOARD_ACCESS_MODES.includes(value as DashboardAccessMode)
}

export function isValidScriptContent(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  const byteLength = new TextEncoder().encode(value).length
  return byteLength <= MAX_CONTENT_LENGTH
}

export function isValidUsername(value: unknown): value is string {
  return typeof value === 'string' && USERNAME_REGEX.test(value)
}

export function isValidDisplayName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_DISPLAY_NAME_LENGTH
}

export function isValidProfileRole(value: unknown): value is ProfileRole {
  return typeof value === 'string' && VALID_PROFILE_ROLES.includes(value as ProfileRole)
}
