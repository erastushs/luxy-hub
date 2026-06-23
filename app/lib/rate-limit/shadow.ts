import type {
  RateLimitBackend,
  RateLimitComparisonResult,
  RateLimitExecutionError,
  RateLimitExecutionResult,
  RateLimitMismatchReason,
  RateLimitResult,
} from './types'

type ShadowOperation = () => Promise<RateLimitResult>

export type RateLimitShadowContext = {
  bucket: string
  limitKey?: string | null
  windowMs?: number | null
  authoritativeBackend: RateLimitBackend
  shadowBackend: RateLimitBackend
}

export type RateLimitShadowExecution = {
  result: RateLimitResult
  comparison: RateLimitComparisonResult
}

function serializeError(error: unknown): RateLimitExecutionError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { name: 'UnknownError', message: 'Unknown rate-limit execution error' }
}

function resultAllowed(result: RateLimitResult | null): boolean | null {
  return result ? result.allowed : null
}

function resultRetryAfter(result: RateLimitResult | null): number | null {
  return result && !result.allowed ? result.retryAfter : null
}

async function executeBackend(
  backend: RateLimitBackend,
  operation: ShadowOperation
): Promise<RateLimitExecutionResult> {
  const startedAt = Date.now()

  try {
    return {
      backend,
      result: await operation(),
      latencyMs: Date.now() - startedAt,
      error: null,
    }
  } catch (error) {
    return {
      backend,
      result: null,
      latencyMs: Date.now() - startedAt,
      error: serializeError(error),
    }
  }
}

function compareExecutions(params: {
  context: RateLimitShadowContext
  authoritative: RateLimitExecutionResult
  shadow: RateLimitExecutionResult
  executedAt: string
}): RateLimitComparisonResult {
  let mismatchReason: RateLimitMismatchReason | null = null

  try {
    if (params.authoritative.error || params.shadow.error) {
      mismatchReason = params.authoritative.error?.name === params.shadow.error?.name
        ? null
        : 'error_state_mismatch'
    }

    if (!mismatchReason && resultAllowed(params.authoritative.result) !== resultAllowed(params.shadow.result)) {
      mismatchReason = 'decision_mismatch'
    }

    if (!mismatchReason && resultRetryAfter(params.authoritative.result) !== resultRetryAfter(params.shadow.result)) {
      mismatchReason = 'retry_after_mismatch'
    }

    if (!mismatchReason && params.context.windowMs == null) {
      mismatchReason = null
    }
  } catch {
    mismatchReason = 'comparison_failed'
  }

  return {
    bucket: params.context.bucket,
    limitKey: params.context.limitKey ?? null,
    windowMs: params.context.windowMs ?? null,
    authoritativeBackend: params.context.authoritativeBackend,
    shadowBackend: params.context.shadowBackend,
    authoritativeAllowed: resultAllowed(params.authoritative.result),
    shadowAllowed: resultAllowed(params.shadow.result),
    authoritativeRetryAfter: resultRetryAfter(params.authoritative.result),
    shadowRetryAfter: resultRetryAfter(params.shadow.result),
    authoritativeLatencyMs: params.authoritative.latencyMs,
    shadowLatencyMs: params.shadow.latencyMs,
    authoritativeError: params.authoritative.error,
    shadowError: params.shadow.error,
    parity: mismatchReason === null,
    mismatchReason,
    executedAt: params.executedAt,
  }
}

function logShadowComparison(comparison: RateLimitComparisonResult): void {
  if (comparison.parity) {
    return
  }

  try {
    console.warn(JSON.stringify({
      timestamp: comparison.executedAt,
      component: 'rate-limit',
      event: 'shadow_mismatch',
      authoritativeBackend: comparison.authoritativeBackend,
      shadowBackend: comparison.shadowBackend,
      parity: comparison.parity,
      mismatchReason: comparison.mismatchReason,
      authoritativeLatencyMs: comparison.authoritativeLatencyMs,
      shadowLatencyMs: comparison.shadowLatencyMs,
    }))
  } catch {
    // Shadow logging must never affect the authoritative decision.
  }
}

export async function executeRateLimitShadow(params: {
  context: RateLimitShadowContext
  authoritative: ShadowOperation
  shadow: ShadowOperation
}): Promise<RateLimitShadowExecution> {
  const executedAt = new Date().toISOString()
  const authoritative = await executeBackend(
    params.context.authoritativeBackend,
    params.authoritative
  )
  const shadow = await executeBackend(params.context.shadowBackend, params.shadow)
  const comparison = compareExecutions({
    context: params.context,
    authoritative,
    shadow,
    executedAt,
  })

  logShadowComparison(comparison)

  if (authoritative.result) {
    return { result: authoritative.result, comparison }
  }

  return {
    result: { allowed: false, retryAfter: 0 },
    comparison,
  }
}
