export function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  const random = (length: number) =>
    Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

  return `LUXY-${random(4)}-${random(4)}-${random(4)}`
}
