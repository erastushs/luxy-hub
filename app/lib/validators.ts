import { MAX_SCRIPT_REQUEST_BODY_BYTES, MAX_SCRIPT_SIZE_BYTES } from '@/app/lib/constants/size-limits'
import {
  FREE_KEY_CURRENT_REGEX,
  FREE_KEY_LEGACY_REGEX,
  freeKeyConfig,
  type FreeKeyFormat,
} from '@/app/config/free-keys'

const MAX_TOKEN_LENGTH = 256
const MAX_BODY_SIZE = MAX_SCRIPT_REQUEST_BODY_BYTES

export function isValidKeyFormat(key: unknown): key is string {
  return getFreeKeyFormat(key) !== null
}

export function getFreeKeyFormat(key: unknown): FreeKeyFormat | null {
  if (typeof key !== 'string') return null
  if (FREE_KEY_CURRENT_REGEX.test(key)) return freeKeyConfig.formats.current
  if (FREE_KEY_LEGACY_REGEX.test(key)) return freeKeyConfig.formats.legacy
  return null
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
export const VALID_SCRIPT_ACCESS_MODES = ['public', 'key_required', 'license_required'] as const
export type ScriptAccessMode = (typeof VALID_SCRIPT_ACCESS_MODES)[number]
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

export function isValidScriptAccessMode(value: unknown): value is ScriptAccessMode {
  return typeof value === 'string' && VALID_SCRIPT_ACCESS_MODES.includes(value as ScriptAccessMode)
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
