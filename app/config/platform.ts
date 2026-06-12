export const DEFAULT_SITE_URL = 'https://www.luxyhub.dev'

export const paginationConfig = {
  defaultLimit: 20,
  defaultOffset: 0,
  maxLimit: 100,
  dashboardScriptListLimit: 12,
} as const

export const analyticsConfig = {
  defaultWindowDays: 30,
  windowOptions: [7, 30, 90],
  serviceWindowOptions: [1, 7, 30, 90],
  topScriptsDefaultLimit: 5,
  topScriptsMaxLimit: 100,
} as const

export const profileConfig = {
  usernameMinLength: 3,
  usernameMaxLength: 30,
  displayNameMaxLength: 80,
  passwordMinLength: 8,
} as const
