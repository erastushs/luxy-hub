import { describe, expect, it } from 'vitest'
import {
  validateSourceFileMetadata,
  validateSourceFileBytes,
  formatFileSize,
  MAX_SOURCE_FILE_BYTES,
} from '@/app/dashboard/lib/source-file'
import {
  MAX_SCRIPT_REQUEST_BODY_BYTES,
  MAX_SCRIPT_SIZE_BYTES,
  MAX_SCRIPT_SIZE_DISPLAY,
} from '@/app/lib/constants/size-limits'
import { isValidScriptContent, validateRequestSize } from '@/app/lib/validators'

const TWO_MB = 2_097_152

function fileLike(name: string, size: number, type = 'text/plain') {
  return { name, size, type }
}

function contentOf(size: number): string {
  let result = ''
  while (result.length < size) {
    result += 'print("hello world!")\n'
  }
  return result.slice(0, size)
}

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

describe('script size limit expansion', () => {
  it('uses a centralized 2 MB script size constant', () => {
    expect(MAX_SCRIPT_SIZE_BYTES).toBe(TWO_MB)
    expect(MAX_SOURCE_FILE_BYTES).toBe(MAX_SCRIPT_SIZE_BYTES)
    expect(MAX_SCRIPT_SIZE_DISPLAY).toBe('2 MB')
  })

  it('formats file sizes in human-readable form', () => {
    expect(formatFileSize(100_000)).toBe('97.7 KB')
    expect(formatFileSize(500_000)).toBe('488.3 KB')
    expect(formatFileSize(900_000)).toBe('878.9 KB')
    expect(formatFileSize(1_048_576)).toBe('1 MB')
    expect(formatFileSize(1_200_000)).toBe('1.1 MB')
    expect(formatFileSize(TWO_MB)).toBe('2 MB')
  })

  describe('file metadata validation', () => {
    it('accepts a 100 KB file', () => {
      expect(validateSourceFileMetadata(fileLike('script.lua', 100_000))).toBeNull()
    })

    it('accepts a 500 KB file', () => {
      expect(validateSourceFileMetadata(fileLike('script.lua', 500_000))).toBeNull()
    })

    it('accepts a 900 KB file', () => {
      expect(validateSourceFileMetadata(fileLike('script.lua', 900_000))).toBeNull()
    })

    it('accepts a file exactly at the 2 MB limit', () => {
      expect(validateSourceFileMetadata(fileLike('script.lua', TWO_MB))).toBeNull()
    })

    it('rejects a file 1 byte over the limit', () => {
      const msg = validateSourceFileMetadata(fileLike('big.lua', TWO_MB + 1))
      expect(msg).toContain('File is')
      expect(msg).toContain('maximum is')
      expect(msg).toContain('2 MB')
    })

    it('rejects a file significantly over the limit', () => {
      const msg = validateSourceFileMetadata(fileLike('big.lua', 2_500_000))
      expect(msg).toContain('maximum is 2 MB')
    })

    it('rejects a .txt file over the limit', () => {
      expect(validateSourceFileMetadata(fileLike('script.txt', TWO_MB + 1))).not.toBeNull()
    })
  })

  describe('server-side content validation parity', () => {
    it('accepts content exactly at 2 MB of UTF-8 bytes', () => {
      const content = contentOf(TWO_MB)
      const byteLength = new TextEncoder().encode(content).length
      expect(byteLength).toBe(TWO_MB)
      expect(isValidScriptContent(content)).toBe(true)
    })

    it('rejects content 1 byte over 2 MB of UTF-8 bytes', () => {
      const content = contentOf(TWO_MB + 1)
      const byteLength = new TextEncoder().encode(content).length
      expect(byteLength).toBeGreaterThan(TWO_MB)
      expect(isValidScriptContent(content)).toBe(false)
    })

    it('allows script request bodies with centralized overhead only up to the configured ceiling', () => {
      expect(validateRequestSize(String(MAX_SCRIPT_REQUEST_BODY_BYTES))).toBe(true)
      expect(validateRequestSize(String(MAX_SCRIPT_REQUEST_BODY_BYTES + 1))).toBe(false)
    })
  })

  describe('source byte validation (no new size limits here)', () => {
    it('still rejects null bytes in large files', () => {
      const arr = new Uint8Array(100_000).fill('a'.charCodeAt(0))
      arr[500] = 0

      expect(validateSourceFileBytes(arr)).toBe('Binary files are not accepted')
    })

    it('accepts a 2 MB valid Lua file', () => {
      const content = contentOf(TWO_MB)
      const buf = bytes(content)

      expect(validateSourceFileBytes(buf)).toBeNull()
    })
  })
})
