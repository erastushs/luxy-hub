const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CHARS_LENGTH = CHARS.length

export function generateKey(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)

  let key = 'LUXY'

  for (let i = 0; i < 12; i++) {
    if (i % 4 === 0) {
      key += '-'
    }
    key += CHARS[bytes[i] % CHARS_LENGTH]
  }

  return key
}

export function generateFreeKey(): string {
  return generateSegmentedKey('LUXY-FREE', 8)
}

export function generatePremiumKey(): string {
  return generateSegmentedKey('LUXY-PREM', 8)
}

function generateSegmentedKey(prefix: string, length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let key = prefix

  for (let i = 0; i < length; i++) {
    if (i % 4 === 0) {
      key += '-'
    }
    key += CHARS[bytes[i] % CHARS_LENGTH]
  }

  return key
}
