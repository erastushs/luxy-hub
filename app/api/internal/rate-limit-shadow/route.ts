import { NextResponse } from 'next/server'
import { AuthError, requireRole } from '@/app/lib/auth/session-auth'
import {
  getRateLimitShadowHealth,
  getRateLimitShadowMetrics,
  getRateLimitShadowOperationalSnapshot,
  getRateLimitShadowParityReport,
} from '@/app/lib/rate-limit/metrics-service'

export async function GET() {
  try {
    await requireRole('admin')

    const health = getRateLimitShadowHealth()
    const metrics = getRateLimitShadowMetrics()
    const parityReport = getRateLimitShadowParityReport()
    const operationalSnapshot = getRateLimitShadowOperationalSnapshot()

    return NextResponse.json({
      enabled: health.enabled,
      runtimeMode: health.runtimeMode,
      health: {
        status: health.status,
        backendFailures: health.backendFailures,
        comparisonFailures: metrics.comparisonFailures,
      },
      metrics: {
        totalComparisons: metrics.totalComparisons,
        identical: metrics.identical,
        mismatches: metrics.mismatches,
        mismatchRate: metrics.mismatchRate,
        averageLatencyDeltaMs: metrics.avgLatencyDeltaMs,
      },
      decisionParity: parityReport.decisionParity,
      retryAfterParity: parityReport.retryAfterParity,
      lastUpdatedAt: metrics.lastUpdatedAt,
      operationalSummary: operationalSnapshot.summary.replaceAll('\n', ' | '),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'rate_limit_shadow_metrics_unavailable',
        message: 'Rate-limit shadow metrics are unavailable',
      },
      { status: 503 }
    )
  }
}
