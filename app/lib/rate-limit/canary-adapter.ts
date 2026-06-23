import { createHash } from 'node:crypto'
import {
  EVENT_RATE_LIMITS,
  LOGIN_FAILURE_WINDOWS,
  WINDOW_MS,
} from './config'
import { executeRateLimitShadow } from './shadow'
import { recordRateLimitRolloutRequest } from './metrics-service'
import type { LimitKey, RateLimitAdapter, RateLimitComparisonResult, RateLimitResult } from './types'

type CanaryBackend = 'postgres' | 'valkey'

export class CanaryRateLimitAdapter implements RateLimitAdapter {
  constructor(
    private readonly postgres: RateLimitAdapter,
    private readonly valkey: RateLimitAdapter,
    private readonly canaryPercentage: number
  ) {}

  async checkGeneralLimit(ip: string, limitKey: LimitKey): Promise<RateLimitResult> {
    return this.checkWithCanary({
      identifier: `general:${limitKey}:${ip}`,
      bucket: 'general',
      limitKey,
      windowMs: WINDOW_MS[limitKey],
      postgres: () => this.postgres.checkGeneralLimit(ip, limitKey),
      valkey: () => this.valkey.checkGeneralLimit(ip, limitKey),
    })
  }

  async checkLoginFailure(ip: string, email: unknown): Promise<RateLimitResult> {
    return this.checkWithCanary({
      identifier: `login_failure:${ip}:${String(email ?? '')}`,
      bucket: 'login_failure',
      limitKey: null,
      windowMs: Math.max(LOGIN_FAILURE_WINDOWS.ip.windowMs, LOGIN_FAILURE_WINDOWS.email.windowMs),
      postgres: () => this.postgres.checkLoginFailure(ip, email),
      valkey: () => this.valkey.checkLoginFailure(ip, email),
    })
  }

  async recordLoginFailure(ip: string, email: unknown): Promise<void> {
    await this.postgres.recordLoginFailure(ip, email)

    try {
      await this.valkey.recordLoginFailure(ip, email)
    } catch {
      // Valkey write failures must not affect PostgreSQL-backed login failure tracking.
    }
  }

  async clearLoginFailures(ip: string, email: unknown): Promise<void> {
    await this.postgres.clearLoginFailures(ip, email)

    try {
      await this.valkey.clearLoginFailures(ip, email)
    } catch {
      // Valkey write failures must not affect PostgreSQL-backed login failure tracking.
    }
  }

  async checkEventLimit(sessionId: string): Promise<RateLimitResult> {
    return this.checkWithCanary({
      identifier: `event_report:${sessionId}`,
      bucket: 'event_report',
      limitKey: null,
      windowMs: EVENT_RATE_LIMITS.windowMs,
      postgres: () => this.postgres.checkEventLimit(sessionId),
      valkey: () => this.valkey.checkEventLimit(sessionId),
    })
  }

  private async checkWithCanary(params: {
    identifier: string
    bucket: string
    limitKey: string | null
    windowMs: number
    postgres: () => Promise<RateLimitResult>
    valkey: () => Promise<RateLimitResult>
  }): Promise<RateLimitResult> {
    const authoritativeBackend = selectCanaryBackend(params.identifier, this.canaryPercentage)

    if (authoritativeBackend === 'postgres') {
      recordRateLimitRolloutRequest('postgres')
      const execution = await executeRateLimitShadow({
        context: {
          bucket: params.bucket,
          limitKey: params.limitKey,
          windowMs: params.windowMs,
          authoritativeBackend: 'postgres',
          shadowBackend: 'valkey',
        },
        authoritative: params.postgres,
        shadow: params.valkey,
      })

      return execution.result
    }

    recordRateLimitRolloutRequest('valkey')

    try {
      const execution = await executeRateLimitShadow({
        context: {
          bucket: params.bucket,
          limitKey: params.limitKey,
          windowMs: params.windowMs,
          authoritativeBackend: 'valkey',
          shadowBackend: 'postgres',
        },
        authoritative: params.valkey,
        shadow: params.postgres,
      })

      if (execution.comparison.authoritativeError) {
        recordRateLimitRolloutRequest('postgres', true)
        return resultFromShadowComparison(execution.comparison) ?? params.postgres()
      }

      return execution.result
    } catch {
      recordRateLimitRolloutRequest('postgres', true)
      return params.postgres()
    }
  }
}

function resultFromShadowComparison(comparison: RateLimitComparisonResult): RateLimitResult | null {
  if (comparison.shadowError || comparison.shadowAllowed === null) {
    return null
  }

  if (comparison.shadowAllowed) {
    return { allowed: true }
  }

  return { allowed: false, retryAfter: comparison.shadowRetryAfter ?? 0 }
}

export function selectCanaryBackend(identifier: string, canaryPercentage: number): CanaryBackend {
  if (canaryPercentage <= 0) {
    return 'postgres'
  }

  if (canaryPercentage >= 100) {
    return 'valkey'
  }

  return stableCanaryBucket(identifier) < canaryPercentage ? 'valkey' : 'postgres'
}

export function stableCanaryBucket(identifier: string): number {
  const hex = createHash('sha256').update(identifier).digest('hex').slice(0, 8)
  return Number.parseInt(hex, 16) % 100
}
