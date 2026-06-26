import { randomBytes } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { getDeliverySessionTraceEnabled } from './config'

const traceStorage = new AsyncLocalStorage<DeliverySessionTracer | null>()

export class DeliverySessionTracer {
  readonly traceId: string
  readonly enabled: boolean

  constructor(traceId?: string) {
    this.traceId = traceId ?? `delivery_${randomBytes(8).toString('hex')}`
    this.enabled = getDeliverySessionTraceEnabled()
  }

  pass(step: string): void {
    if (!this.enabled) return
    console.log(`[delivery][${this.traceId}] PASS ${step}`)
  }

  fail(step: string, reason: string): void {
    if (!this.enabled) return
    console.log(`[delivery][${this.traceId}] FAIL ${step}`)
    console.log(`[delivery][${this.traceId}]   reason=${reason}`)
  }

  adapter(name: string, selectedBackend?: string): void {
    if (!this.enabled) return
    const parts = [`adapter=${name}`]
    if (selectedBackend) {
      parts.push(`selectedBackend=${selectedBackend}`)
    }
    console.log(`[delivery][${this.traceId}] ${parts.join(' ')}`)
  }

  fallback(backend: string, fallbackTo: string, reason: string): void {
    if (!this.enabled) return
    console.log(`[delivery][${this.traceId}] FALLBACK`)
    console.log(`[delivery][${this.traceId}]   backend=${backend}`)
    console.log(`[delivery][${this.traceId}]   fallback=${fallbackTo}`)
    console.log(`[delivery][${this.traceId}]   reason=${reason}`)
  }

  shadow(authoritative: string, shadowBackend: string, comparison: string): void {
    if (!this.enabled) return
    console.log(`[delivery][${this.traceId}] SHADOW`)
    console.log(`[delivery][${this.traceId}]   authoritative=${authoritative}`)
    console.log(`[delivery][${this.traceId}]   shadow=${shadowBackend}`)
    console.log(`[delivery][${this.traceId}]   comparison=${comparison}`)
  }

  exception(step: string, error: unknown): void {
    if (!this.enabled) return
    const name = error instanceof Error ? error.name : 'UnknownError'
    const message = error instanceof Error ? error.message : String(error)
    console.log(`[delivery][${this.traceId}] EXCEPTION`)
    console.log(`[delivery][${this.traceId}]   step=${step}`)
    console.log(`[delivery][${this.traceId}]   exception=${name}`)
    console.log(`[delivery][${this.traceId}]   message=${message}`)
    if (process.env.NODE_ENV !== 'production') {
      const stack = error instanceof Error ? error.stack : undefined
      if (stack) {
        console.log(`[delivery][${this.traceId}]   stack=${stack}`)
      }
    }
  }

  success(): void {
    if (!this.enabled) return
    console.log(`[delivery][${this.traceId}] SUCCESS`)
  }

  error(): void {
    if (!this.enabled) return
    console.log(`[delivery][${this.traceId}] FAILURE`)
  }
}

export function createTracer(traceId?: string): DeliverySessionTracer {
  return new DeliverySessionTracer(traceId)
}

export function runWithTracer<T>(tracer: DeliverySessionTracer, fn: () => T): T {
  return traceStorage.run(tracer, fn)
}

export function getCurrentTracer(): DeliverySessionTracer {
  const tracer = traceStorage.getStore()
  return tracer ?? new DeliverySessionTracer('noop')
}
