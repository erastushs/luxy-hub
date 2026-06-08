export const MAX_SOURCE_FILE_BYTES = 62 * 1024
export const ACCEPTED_SOURCE_EXTENSIONS = ['.lua', '.txt'] as const

const ARCHIVE_EXTENSIONS = new Set([
  '.7z',
  '.bz2',
  '.gz',
  '.rar',
  '.tar',
  '.tgz',
  '.xz',
  '.zip',
])

const EXECUTABLE_EXTENSIONS = new Set([
  '.app',
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.dmg',
  '.exe',
  '.msi',
  '.ps1',
  '.scr',
  '.sh',
])

const BLOCKED_MIME_TYPES = new Set([
  'application/gzip',
  'application/java-archive',
  'application/vnd.microsoft.portable-executable',
  'application/x-7z-compressed',
  'application/x-apple-diskimage',
  'application/x-bat',
  'application/x-dosexec',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-rar-compressed',
  'application/x-sh',
  'application/x-tar',
  'application/zip',
])

export type SourceFileLike = {
  name: string
  size: number
  type?: string
}

export type SourceFileMetadata = {
  name: string
  size: number
}

export type SourceFileReadResult =
  | {
      success: true
      content: string
      metadata: SourceFileMetadata
    }
  | {
      success: false
      message: string
    }

function getExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  return index >= 0 ? filename.slice(index).toLowerCase() : ''
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`
  return `${(kilobytes / 1024).toFixed(1)} MB`
}

export function validateSourceFileMetadata(file: SourceFileLike): string | null {
  const extension = getExtension(file.name)

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return 'Archive files are not accepted'
  }

  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    return 'Executable files are not accepted'
  }

  if (!ACCEPTED_SOURCE_EXTENSIONS.includes(extension as (typeof ACCEPTED_SOURCE_EXTENSIONS)[number])) {
    return 'Only .lua and .txt files are accepted'
  }

  if (file.size <= 0) {
    return 'File is empty'
  }

  if (file.size > MAX_SOURCE_FILE_BYTES) {
    return 'File must not exceed 62 KB'
  }

  if (file.type && BLOCKED_MIME_TYPES.has(file.type.toLowerCase())) {
    return 'This file type is not accepted'
  }

  return null
}

export function validateSourceFileBytes(bytes: Uint8Array): string | null {
  if (bytes.length === 0) {
    return 'File is empty'
  }

  const sample = bytes.slice(0, Math.min(bytes.length, 4096))
  let controlBytes = 0

  for (const byte of sample) {
    if (byte === 0) return 'Binary files are not accepted'
    const isAllowedWhitespace = byte === 9 || byte === 10 || byte === 13
    if (byte < 32 && !isAllowedWhitespace) {
      controlBytes += 1
    }
  }

  if (sample.length > 0 && controlBytes / sample.length > 0.05) {
    return 'Binary files are not accepted'
  }

  return null
}

export function decodeSourceFileBytes(bytes: Uint8Array): SourceFileReadResult {
  const byteError = validateSourceFileBytes(bytes)
  if (byteError) {
    return { success: false, message: byteError }
  }

  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (!content.trim()) {
      return { success: false, message: 'File must contain source text' }
    }

    return {
      success: true,
      content,
      metadata: {
        name: '',
        size: bytes.length,
      },
    }
  } catch {
    return { success: false, message: 'File must be valid UTF-8 text' }
  }
}

export async function readSourceFile(file: File): Promise<SourceFileReadResult> {
  const metadataError = validateSourceFileMetadata(file)
  if (metadataError) {
    return { success: false, message: metadataError }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const decoded = decodeSourceFileBytes(bytes)
  if (!decoded.success) return decoded

  return {
    success: true,
    content: decoded.content,
    metadata: {
      name: file.name,
      size: file.size,
    },
  }
}
