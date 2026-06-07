export function hashSnippet(value: string, length: number = 8): string {
  return `${value.slice(0, length)}...`
}
