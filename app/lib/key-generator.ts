import { freeKeyConfig } from '@/app/config/free-keys'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CHARS_LENGTH = CHARS.length

export function generateKey(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)

  let key = freeKeyConfig.currentPrefix

  for (let i = 0; i < 12; i++) {
    if (i % 4 === 0) {
      key += '-'
    }
    key += CHARS[bytes[i] % CHARS_LENGTH]
  }

  return key
}
