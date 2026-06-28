import type { DeliverySessionData, DeliverySessionBackend, DeliverySessionComparisonResult, DeliverySessionExecutionError, DeliverySessionExecutionResult } from './types'

type ShadowOperation = () => Promise<DeliverySessionData | null>

export type DeliverySessionShadowContext = {
  operation: 'create' | 'get' | 'consume'
  authoritativeBackend: DeliverySessionBackend
  shadowBackend: DeliverySessionBackend
}

export type DeliverySessionShadowExecution = {
  result: DeliverySessionData | null
  comparison: DeliverySessionComparisonResult
}

function serializeError(error: unknown): DeliverySessionExecutionError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }
  return { name: 'UnknownError', message: 'Unknown delivery session execution error' }
}

async function executeBackend(
  backend: DeliverySessionBackend,
  operation: ShadowOperation
): Promise<DeliverySessionExecutionResult> {
  const startedAt = Date.now()
  try {
    return {
      backend,
      data: await operation(),
      latencyMs: Date.now() - startedAt,
      error: null,
    }
  } catch (error) {
    return {
      backend,
      data: null,
      latencyMs: Date.now() - startedAt,
      error: serializeError(error),
    }
  }
}

export async function executeDeliverySessionShadow(params: {
  context: DeliverySessionShadowContext
  authoritative: ShadowOperation
  shadow: ShadowOperation
}): Promise<DeliverySessionShadowExecution> {
  const executedAt = new Date().toISOString()
  const authoritative = await executeBackend(params.context.authoritativeBackend, params.authoritative)
  const shadow = await executeBackend(params.context.shadowBackend, params.shadow)
  const comparison = compareExecutions({
    context: params.context,
    authoritative,
    shadow,
    executedAt,
  })
  return { result: authoritative.data, comparison }
}

function compareExecutions(params: {
  context: DeliverySessionShadowContext
  authoritative: DeliverySessionExecutionResult
  shadow: DeliverySessionExecutionResult
  executedAt: string
}): DeliverySessionComparisonResult {
  let mismatchReason: string | null = null
  const mismatchFields: string[] = []

  if (params.authoritative.error || params.shadow.error) {
    mismatchReason = 'backend_error'
  } else if (params.authoritative.data === null && params.shadow.data !== null) {
    mismatchReason = 'data_mismatch'
  } else if (params.authoritative.data !== null && params.shadow.data === null) {
    mismatchReason = 'data_mismatch'
  } else if (params.authoritative.data && params.shadow.data) {
    if (params.authoritative.data.session_token_hash !== params.shadow.data.session_token_hash) {
      mismatchReason = 'token_hash_mismatch'
      mismatchFields.push('session_token_hash')
    }
    if (params.authoritative.data.script_id !== params.shadow.data.script_id) {
      mismatchFields.push('script_id')
    }
    if (params.authoritative.data.build_id !== params.shadow.data.build_id) {
      mismatchFields.push('build_id')
    }
    if (params.authoritative.data.expires_at !== params.shadow.data.expires_at) {
      mismatchFields.push('expires_at')
    }
    if (params.authoritative.data.consumed_at !== params.shadow.data.consumed_at) {
      mismatchFields.push('consumed_at')
    }
    if (params.context.operation === 'consume') {
      const authConsumed = !!params.authoritative.data.consumed_at
      const shadowConsumed = !!params.shadow.data.consumed_at
      if (authConsumed !== shadowConsumed) {
        if (!mismatchReason) mismatchReason = 'consumed_state_mismatch'
        if (!mismatchFields.includes('consumed_at')) mismatchFields.push('consumed_at')
      }
    }
  }

  return {
    operation: params.context.operation,
    authoritativeBackend: params.context.authoritativeBackend,
    shadowBackend: params.context.shadowBackend,
    authoritativeData: params.authoritative.data,
    shadowData: params.shadow.data,
    authoritativeLatencyMs: params.authoritative.latencyMs,
    shadowLatencyMs: params.shadow.latencyMs,
    authoritativeError: params.authoritative.error,
    shadowError: params.shadow.error,
    parity: mismatchReason === null,
    mismatchReason,
    mismatchFields,
    executedAt: params.executedAt,
  }
}
