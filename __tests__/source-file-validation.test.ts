import { describe, expect, it } from 'vitest'
import {
  decodeSourceFileBytes,
  validateSourceFileBytes,
  validateSourceFileMetadata,
} from '@/app/dashboard/lib/source-file'
import { getBuildStatusDisplay } from '@/app/dashboard/components/BuildStatusBadge'

function fileLike(name: string, size: number, type = 'text/plain') {
  return { name, size, type }
}

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

describe('Phase 6A source file validation', () => {
  it('accepts valid Lua files', () => {
    const content = bytes('print("hello")\n')

    expect(validateSourceFileMetadata(fileLike('main.lua', content.length))).toBeNull()
    expect(validateSourceFileBytes(content)).toBeNull()

    const decoded = decodeSourceFileBytes(content)
    expect(decoded.success).toBe(true)
    if (decoded.success) {
      expect(decoded.content).toContain('print("hello")')
    }
  })

  it('accepts valid text source files', () => {
    const content = bytes('-- script source\nreturn true\n')

    expect(validateSourceFileMetadata(fileLike('source.txt', content.length))).toBeNull()
    expect(validateSourceFileBytes(content)).toBeNull()
  })

  it('rejects archive and executable extensions', () => {
    expect(validateSourceFileMetadata(fileLike('source.zip', 12))).toBe('Archive files are not accepted')
    expect(validateSourceFileMetadata(fileLike('source.exe', 12))).toBe('Executable files are not accepted')
  })

  it('rejects binary files even when the extension is allowed', () => {
    const binary = new Uint8Array([0x4d, 0x5a, 0x00, 0x02, 0xff])

    expect(validateSourceFileMetadata(fileLike('payload.lua', binary.length, 'application/octet-stream'))).toBeNull()
    expect(validateSourceFileBytes(binary)).toBe('Binary files are not accepted')
  })

  it('renders build status labels for dashboard badges', () => {
    expect(getBuildStatusDisplay('ready').label).toBe('Ready')
    expect(getBuildStatusDisplay('building').label).toBe('Building')
    expect(getBuildStatusDisplay('failed').label).toBe('Failed')
    expect(getBuildStatusDisplay('invalidated').label).toBe('Invalidated')
  })
})
