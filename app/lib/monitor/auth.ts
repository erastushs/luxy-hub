import { createHash, timingSafeEqual } from 'node:crypto'
import { headers } from 'next/headers'

export class MonitorAuthError extends Error {
  status: number

  constructor(message = 'Unauthorized', status = 401) {
    super(message)
    this.name = 'MonitorAuthError'
    this.status = status
  }
}

export type MonitorAuthOptions = {
  headers?: Headers
  env?: Record<string, string | undefined>
}

export async function requireMonitorAuth(options: MonitorAuthOptions = {}): Promise<void> {
  const monitorToken = getMonitorToken(options.env ?? process.env)

  if (!monitorToken) {
    throw new MonitorAuthError('Unauthorized', 401)
  }

  const requestHeaders = options.headers ?? (await headers())
  const presentedToken = readPresentedToken(requestHeaders)

  if (!presentedToken || !constantTimeTokenMatch(monitorToken, presentedToken)) {
    throw new MonitorAuthError('Unauthorized', 401)
  }
}

function getMonitorToken(env: Record<string, string | undefined>): string | null {
  const token = env.LUXY_MONITOR_TOKEN
  return token && token.length > 0 ? token : null
}

function readPresentedToken(requestHeaders: Headers): string | null {
  const authorization = requestHeaders.get('authorization')
  const bearerToken = readBearerToken(authorization)
  if (bearerToken) {
    return bearerToken
  }

  const headerToken = requestHeaders.get('x-luxy-monitor-token')
  return headerToken && headerToken.length > 0 ? headerToken : null
}

function readBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null
  }

  const bearerPrefix = /^Bearer\s+(.+)$/i
  const match = authorizationHeader.match(bearerPrefix)
  if (!match) {
    return null
  }

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

function constantTimeTokenMatch(expected: string, actual: string): boolean {
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest()
  const actualDigest = createHash('sha256').update(actual, 'utf8').digest()

  return timingSafeEqual(expectedDigest, actualDigest)
}
