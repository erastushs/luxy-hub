import { runtimeConfig } from '@/app/config/runtime'

export { runtimeConfig }

export const deliveryConfig = {
  sessionTtlSeconds: runtimeConfig.deliverySessionTtlSeconds,
  sessionTokenBytes: runtimeConfig.deliverySessionTokenBytes,
  eventSecretBytes: runtimeConfig.eventSecretBytes,
} as const
