export const runtimeConfig = {
  maxTokenLength: 256,
  deliverySessionTtlSeconds: 60,
  deliverySessionTokenBytes: 32,
  eventSecretBytes: 32,
  eventReporting: {
    maxPayloadBytes: 4096,
    maxTimestampSkewSeconds: 300,
    maxEventsPerSessionPerMinute: 10,
    rateLimitWindowMs: 60_000,
    nonceHexLength: 32,
    hexSignatureLength: 64,
    base64SignatureLength: 44,
    minSessionIdLength: 43,
    maxSessionIdLength: 256,
  },
} as const
