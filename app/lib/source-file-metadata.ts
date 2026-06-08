const UPLOAD_CHANGELOG_PREFIX = 'Uploaded file: '
const MAX_SOURCE_FILENAME_LENGTH = 120

export function sanitizeSourceFilename(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const basename = value
    .split(/[\\/]/)
    .pop()
    ?.trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')

  if (!basename) return null

  const lower = basename.toLowerCase()
  if (!lower.endsWith('.lua') && !lower.endsWith('.txt')) return null

  return basename.slice(0, MAX_SOURCE_FILENAME_LENGTH)
}

export function createUploadChangelog(value: unknown): string | undefined {
  const filename = sanitizeSourceFilename(value)
  return filename ? `${UPLOAD_CHANGELOG_PREFIX}${filename}` : undefined
}

export function parseUploadedFilename(changelog: string | null | undefined): string | null {
  if (!changelog?.startsWith(UPLOAD_CHANGELOG_PREFIX)) return null

  return sanitizeSourceFilename(changelog.slice(UPLOAD_CHANGELOG_PREFIX.length))
}
