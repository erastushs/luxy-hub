export function isValidKeyFormat(key: string) {
  return /^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)
}
