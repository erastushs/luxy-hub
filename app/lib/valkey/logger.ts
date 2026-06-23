type ValkeyLogLevel = 'info' | 'warn' | 'error'

type ValkeyLogEvent =
  | 'connection'
  | 'reconnect'
  | 'disconnect'
  | 'health_failure'
  | 'configuration_error'

type ValkeyLogData = Record<string, string | number | boolean | null | undefined>

const SENSITIVE_FIELD_PATTERN = /(password|secret|token|key|payload|credential|authorization)/i

function sanitizeLogData(data: ValkeyLogData = {}): ValkeyLogData {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !SENSITIVE_FIELD_PATTERN.test(key))
      .map(([key, value]) => [key, value])
  )
}

export function logValkeyEvent(
  level: ValkeyLogLevel,
  event: ValkeyLogEvent,
  data: ValkeyLogData = {}
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    component: 'valkey',
    event,
    ...sanitizeLogData(data),
  }

  if (level === 'error') {
    console.error(JSON.stringify(payload))
    return
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload))
    return
  }

  console.info(JSON.stringify(payload))
}
