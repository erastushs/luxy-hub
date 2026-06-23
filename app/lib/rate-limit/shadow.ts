import type {
  RateLimitBackend,
  RateLimitComparisonResult,
  RateLimitExecutionError,
  RateLimitExecutionResult,
  RateLimitMismatchReason,
  RateLimitParityMetric,
  RateLimitResult,
  RateLimitShadowParityReport,
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

type MutableShadowMetrics = {
  totalComparisons: number
  identical: number
  mismatches: number
  backendFailures: number
  totalLatencyDeltaMs: number
  decisionParity: {
    allow: Omit<RateLimitParityMetric, 'rate'>
    deny: Omit<RateLimitParityMetric, 'rate'>
  }
  retryAfterParity: Omit<RateLimitParityMetric, 'rate'>
}

const shadowMetrics: MutableShadowMetrics = {
  totalComparisons: 0,
  identical: 0,
  mismatches: 0,
  backendFailures: 0,
  totalLatencyDeltaMs: 0,
  decisionParity: {
    allow: { total: 0, identical: 0 },
    deny: { total: 0, identical: 0 },
  },
  retryAfterParity: { total: 0, identical: 0 },
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

function createFailedComparison(params: {
  context: RateLimitShadowContext
  authoritative: RateLimitExecutionResult
  shadow: RateLimitExecutionResult
  executedAt: string
}): RateLimitComparisonResult {
  return {
    bucket: params.context.bucket,
    limitKey: params.context.limitKey ?? null,
    windowMs: params.context.windowMs ?? null,
    authoritativeBackend: params.context.authoritativeBackend,
    shadowBackend: params.context.shadowBackend,
    authoritativeAllowed: null,
    shadowAllowed: null,
    authoritativeRetryAfter: null,
    shadowRetryAfter: null,
    authoritativeLatencyMs: params.authoritative.latencyMs,
    shadowLatencyMs: params.shadow.latencyMs,
    authoritativeError: params.authoritative.error,
    shadowError: params.shadow.error,
    parity: false,
    mismatchReason: 'comparison_failed',
    executedAt: params.executedAt,
  }
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
  let authoritativeAllowed: boolean | null = null
  let shadowAllowed: boolean | null = null
  let authoritativeRetryAfter: number | null = null
  let shadowRetryAfter: number | null = null

  try {
    authoritativeAllowed = resultAllowed(params.authoritative.result)
    shadowAllowed = resultAllowed(params.shadow.result)
    authoritativeRetryAfter = resultRetryAfter(params.authoritative.result)
    shadowRetryAfter = resultRetryAfter(params.shadow.result)

    if (params.authoritative.error || params.shadow.error) {
      mismatchReason = params.authoritative.error?.name === params.shadow.error?.name
        ? null
        : 'error_state_mismatch'
    }

    if (!mismatchReason && authoritativeAllowed !== shadowAllowed) {
      mismatchReason = 'decision_mismatch'
    }

    if (!mismatchReason && authoritativeRetryAfter !== shadowRetryAfter) {
      mismatchReason = 'retry_after_mismatch'
    }

    if (!mismatchReason && params.context.windowMs == null) {
      mismatchReason = null
    }
  } catch {
    return createFailedComparison(params)
  }

  return {
    bucket: params.context.bucket,
    limitKey: params.context.limitKey ?? null,
    windowMs: params.context.windowMs ?? null,
    authoritativeBackend: params.context.authoritativeBackend,
    shadowBackend: params.context.shadowBackend,
    authoritativeAllowed,
    shadowAllowed,
    authoritativeRetryAfter,
    shadowRetryAfter,
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
      retryAfterDeltaSeconds: retryAfterDeltaSeconds(comparison),
      authoritativeLatencyMs: comparison.authoritativeLatencyMs,
      shadowLatencyMs: comparison.shadowLatencyMs,
      latencyDeltaMs: latencyDeltaMs(comparison),
    }))
  } catch {
    // Shadow logging must never affect the authoritative decision.
  }
}

function retryAfterDeltaSeconds(comparison: RateLimitComparisonResult): number | null {
  if (comparison.authoritativeRetryAfter === null || comparison.shadowRetryAfter === null) {
    return null
  }

  return comparison.shadowRetryAfter - comparison.authoritativeRetryAfter
}

function latencyDeltaMs(comparison: RateLimitComparisonResult): number {
  return comparison.shadowLatencyMs - comparison.authoritativeLatencyMs
}

function metricRate(metric: Omit<RateLimitParityMetric, 'rate'>): RateLimitParityMetric {
  return {
    total: metric.total,
    identical: metric.identical,
    rate: metric.total === 0 ? 0 : metric.identical / metric.total,
  }
}

function recordComparisonMetrics(comparison: RateLimitComparisonResult): void {
  try {
    shadowMetrics.totalComparisons += 1
    shadowMetrics.totalLatencyDeltaMs += latencyDeltaMs(comparison)

    if (comparison.parity) {
      shadowMetrics.identical += 1
    } else {
      shadowMetrics.mismatches += 1
    }

    if (comparison.authoritativeError || comparison.shadowError) {
      shadowMetrics.backendFailures += 1
    }

    if (comparison.authoritativeAllowed === true) {
      shadowMetrics.decisionParity.allow.total += 1
      if (comparison.shadowAllowed === true) {
        shadowMetrics.decisionParity.allow.identical += 1
      }
    }

    if (comparison.authoritativeAllowed === false) {
      shadowMetrics.decisionParity.deny.total += 1
      if (comparison.shadowAllowed === false) {
        shadowMetrics.decisionParity.deny.identical += 1
      }
    }

    if (comparison.authoritativeRetryAfter !== null) {
      shadowMetrics.retryAfterParity.total += 1
      if (comparison.authoritativeRetryAfter === comparison.shadowRetryAfter) {
        shadowMetrics.retryAfterParity.identical += 1
      }
    }
  } catch {
    // Metrics collection must never affect the authoritative decision.
  }
}

export function getRateLimitShadowParityReport(): RateLimitShadowParityReport {
  return {
    totalComparisons: shadowMetrics.totalComparisons,
    identical: shadowMetrics.identical,
    mismatches: shadowMetrics.mismatches,
    mismatchRate: shadowMetrics.totalComparisons === 0
      ? 0
      : shadowMetrics.mismatches / shadowMetrics.totalComparisons,
    backendFailures: shadowMetrics.backendFailures,
    avgLatencyDeltaMs: shadowMetrics.totalComparisons === 0
      ? 0
      : shadowMetrics.totalLatencyDeltaMs / shadowMetrics.totalComparisons,
    decisionParity: {
      allow: metricRate(shadowMetrics.decisionParity.allow),
      deny: metricRate(shadowMetrics.decisionParity.deny),
    },
    retryAfterParity: metricRate(shadowMetrics.retryAfterParity),
  }
}

export function resetRateLimitShadowMetricsForTests(): void {
  shadowMetrics.totalComparisons = 0
  shadowMetrics.identical = 0
  shadowMetrics.mismatches = 0
  shadowMetrics.backendFailures = 0
  shadowMetrics.totalLatencyDeltaMs = 0
  shadowMetrics.decisionParity.allow.total = 0
  shadowMetrics.decisionParity.allow.identical = 0
  shadowMetrics.decisionParity.deny.total = 0
  shadowMetrics.decisionParity.deny.identical = 0
  shadowMetrics.retryAfterParity.total = 0
  shadowMetrics.retryAfterParity.identical = 0
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

  recordComparisonMetrics(comparison)
  logShadowComparison(comparison)

  if (authoritative.result) {
    return { result: authoritative.result, comparison }
  }

  return {
    result: { allowed: false, retryAfter: 0 },
    comparison,
  }
}
