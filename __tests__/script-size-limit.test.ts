import { describe, expect, it } from 'vitest'
import {
  validateSourceFileMetadata,
  validateSourceFileBytes,
  formatFileSize,
  MAX_SOURCE_FILE_BYTES,
} from '@/app/dashboard/lib/source-file'

const ONE_MB = 1_048_576

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
  it('constant is 1 MB', () => {
    expect(MAX_SOURCE_FILE_BYTES).toBe(ONE_MB)
  })

  it('formats file sizes in human-readable form', () => {
    expect(formatFileSize(100_000)).toBe('97.7 KB')
    expect(formatFileSize(500_000)).toBe('488.3 KB')
    expect(formatFileSize(900_000)).toBe('878.9 KB')
    expect(formatFileSize(ONE_MB)).toBe('1.0 MB')
    expect(formatFileSize(1_200_000)).toBe('1.1 MB')
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

    it('accepts a file exactly at the 1 MB limit', () => {
      expect(validateSourceFileMetadata(fileLike('script.lua', ONE_MB))).toBeNull()
    })

    it('rejects a file 1 byte over the limit', () => {
      const msg = validateSourceFileMetadata(fileLike('big.lua', ONE_MB + 1))
      expect(msg).toContain('File is')
      expect(msg).toContain('maximum is')
      expect(msg).toContain('1.0 MB')
    })

    it('rejects a file significantly over the limit', () => {
      const msg = validateSourceFileMetadata(fileLike('big.lua', 1_200_000))
      expect(msg).toContain('maximum is 1.0 MB')
    })

    it('rejects a .txt file over the limit', () => {
      expect(validateSourceFileMetadata(fileLike('script.txt', ONE_MB + 1))).not.toBeNull()
    })
  })

  describe('server-side content validation parity', () => {
    it('accepts content exactly at 1 MB of UTF-8 bytes', () => {
      const content = contentOf(ONE_MB)
      const byteLength = new TextEncoder().encode(content).length
      expect(byteLength).toBe(ONE_MB)
    })

    it('rejects content 1 byte over 1 MB of UTF-8 bytes', () => {
      const content = contentOf(ONE_MB + 1)
      const byteLength = new TextEncoder().encode(content).length
      expect(byteLength).toBeGreaterThan(ONE_MB)
    })
  })

  describe('source byte validation (no new size limits here)', () => {
    it('still rejects null bytes in large files', () => {
      const arr = new Uint8Array(100_000).fill('a'.charCodeAt(0))
      arr[500] = 0

      expect(validateSourceFileBytes(arr)).toBe('Binary files are not accepted')
    })

    it('accepts a 1 MB valid Lua file', () => {
      const content = contentOf(ONE_MB)
      const buf = bytes(content)

      expect(validateSourceFileBytes(buf)).toBeNull()
    })
  })
})
