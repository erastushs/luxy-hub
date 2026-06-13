export const cleanupConfig = {
  retentionDays: {
    usedWorkinkTokens: 3,
    rateLimits: 3,
    verificationLogs: 30,
    scriptDownloads: 90,
    deliveredEvents: 30,
    deadLetterEvents: 90,
    pendingEvents: 7,
  },
  batchSizes: {
    usedWorkinkTokens: 5000,
    rateLimits: 10000,
    verificationLogs: 5000,
    scriptDownloads: 10000,
  },
} as const
