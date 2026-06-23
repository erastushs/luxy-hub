import {
  EVENT_RATE_LIMITS,
  LOGIN_FAILURE_WINDOWS,
  WINDOW_MS,
} from './config'
import { executeRateLimitShadow } from './shadow'
import type { LimitKey, RateLimitAdapter, RateLimitResult } from './types'

export class ShadowRateLimitAdapter implements RateLimitAdapter {
  constructor(
    private readonly authoritative: RateLimitAdapter,
    private readonly shadow: RateLimitAdapter
  ) {}

  async checkGeneralLimit(ip: string, limitKey: LimitKey): Promise<RateLimitResult> {
    const execution = await executeRateLimitShadow({
      context: {
        bucket: 'general',
        limitKey,
        windowMs: WINDOW_MS[limitKey],
        authoritativeBackend: 'postgres',
        shadowBackend: 'valkey',
      },
      authoritative: () => this.authoritative.checkGeneralLimit(ip, limitKey),
      shadow: () => this.shadow.checkGeneralLimit(ip, limitKey),
    })

    return execution.result
  }

  async checkLoginFailure(ip: string, email: unknown): Promise<RateLimitResult> {
    const execution = await executeRateLimitShadow({
      context: {
        bucket: 'login_failure',
        limitKey: null,
        windowMs: Math.max(LOGIN_FAILURE_WINDOWS.ip.windowMs, LOGIN_FAILURE_WINDOWS.email.windowMs),
        authoritativeBackend: 'postgres',
        shadowBackend: 'valkey',
      },
      authoritative: () => this.authoritative.checkLoginFailure(ip, email),
      shadow: () => this.shadow.checkLoginFailure(ip, email),
    })

    return execution.result
  }

  async recordLoginFailure(ip: string, email: unknown): Promise<void> {
    await this.authoritative.recordLoginFailure(ip, email)

    try {
      await this.shadow.recordLoginFailure(ip, email)
    } catch {
      // Shadow write failures must not affect PostgreSQL-authoritative behavior.
    }
  }

  async clearLoginFailures(ip: string, email: unknown): Promise<void> {
    await this.authoritative.clearLoginFailures(ip, email)

    try {
      await this.shadow.clearLoginFailures(ip, email)
    } catch {
      // Shadow write failures must not affect PostgreSQL-authoritative behavior.
    }
  }

  async checkEventLimit(sessionId: string): Promise<RateLimitResult> {
    const execution = await executeRateLimitShadow({
      context: {
        bucket: 'event_report',
        limitKey: null,
        windowMs: EVENT_RATE_LIMITS.windowMs,
        authoritativeBackend: 'postgres',
        shadowBackend: 'valkey',
      },
      authoritative: () => this.authoritative.checkEventLimit(sessionId),
      shadow: () => this.shadow.checkEventLimit(sessionId),
    })

    return execution.result
  }
}
