export const FREE_KEY_LEGACY_REGEX = /^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
export const FREE_KEY_CURRENT_REGEX = /^LUXY-FREE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

export const freeKeyConfig = {
  currentPrefix: 'LUXY-FREE',
  expiresInDays: 1,
  maxGenerationAttempts: 5,
  formats: {
    legacy: 'legacy',
    current: 'current',
  },
} as const

export type FreeKeyFormat = typeof freeKeyConfig.formats[keyof typeof freeKeyConfig.formats]
