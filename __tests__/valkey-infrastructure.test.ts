import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getValkeyConfig } from '@/app/lib/valkey/config'
import { createValkeyConnectionManager } from '@/app/lib/valkey/connection'
import { checkValkeyHealth } from '@/app/lib/valkey/health'
import {
  getValkeyMetricsSnapshot,
  resetValkeyMetricsForTests,
} from '@/app/lib/valkey/metrics'
import {
  createValkeyKey,
  createValkeyKeyPrefix,
  getValkeyEnvironment,
  hashValkeyIdentifier,
} from '@/app/lib/valkey/namespace'
import type { ValkeyClient, ValkeyConfig } from '@/app/lib/valkey/types'

class FakeValkeyClient implements ValkeyClient {
  isOpen = false
  isReady = false
  connectCalls = 0
  quitCalls = 0
  shouldConnectFail = false
  shouldPingFail = false
  pingResponse = 'PONG'
  serverInfo = 'redis_version:7.2.0\r\n'
  memoryInfo = 'used_memory:12345\r\n'
  listeners = new Map<string, Array<(...args: unknown[]) => void>>()

  async connect() {
    this.connectCalls += 1

    if (this.shouldConnectFail) {
      throw new Error('connect failed')
    }

    this.isOpen = true
    this.isReady = true
    this.emit('connect')
    this.emit('ready')
  }

  async quit() {
    this.quitCalls += 1
    this.isOpen = false
    this.isReady = false
    this.emit('end')
  }

  disconnect() {
    this.isOpen = false
    this.isReady = false
    this.emit('end')
  }

  async ping() {
    if (this.shouldPingFail) {
      throw new Error('ping failed')
    }

    return this.pingResponse
  }

  async info(section?: string) {
    return section === 'memory' ? this.memoryInfo : this.serverInfo
  }

  on(event: string, listener: (...args: unknown[]) => void) {
    const listeners = this.listeners.get(event) ?? []
    listeners.push(listener)
    this.listeners.set(event, listeners)
    return this
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args)
    }
  }
}

function enabledConfig(overrides: Partial<ValkeyConfig> = {}): ValkeyConfig {
  return {
    enabled: true,
    requestedEnabled: true,
    host: '127.0.0.1',
    port: 6379,
    password: null,
    database: 0,
    tls: false,
    connectTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    errors: [],
    ...overrides,
  }
}

describe('Phase 7D.1 Valkey infrastructure', () => {
  beforeEach(() => {
    resetValkeyMetricsForTests()
    vi.restoreAllMocks()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('keeps Valkey disabled by default', () => {
    const config = getValkeyConfig({})

    expect(config.enabled).toBe(false)
    expect(config.requestedEnabled).toBe(false)
    expect(config.errors).toEqual([])
  })

  it('fails safely when enabled configuration is invalid', () => {
    const config = getValkeyConfig({
      VALKEY_ENABLED: 'true',
      VALKEY_PORT: 'not-a-port',
      VALKEY_PASSWORD: 'super-secret',
    })

    expect(config.enabled).toBe(false)
    expect(config.requestedEnabled).toBe(true)
    expect(config.errors).toContain('VALKEY_HOST is required when VALKEY_ENABLED is true')
    expect(config.errors).toContain('VALKEY_PORT must be an integer between 1 and 65535')
    expect(config.password).toBe('super-secret')
  })

  it('parses valid server-side configuration', () => {
    const config = getValkeyConfig({
      VALKEY_ENABLED: 'true',
      VALKEY_HOST: 'valkey.internal',
      VALKEY_PORT: '6380',
      VALKEY_PASSWORD: 'super-secret',
      VALKEY_DB: '2',
      VALKEY_TLS: 'true',
      VALKEY_CONNECT_TIMEOUT_MS: '2500',
      VALKEY_COMMAND_TIMEOUT_MS: '1500',
    })

    expect(config).toMatchObject({
      enabled: true,
      requestedEnabled: true,
      host: 'valkey.internal',
      port: 6380,
      password: 'super-secret',
      database: 2,
      tls: true,
      connectTimeoutMs: 2500,
      commandTimeoutMs: 1500,
      errors: [],
    })
  })

  it('does not create or connect a client in disabled mode', async () => {
    const factory = vi.fn(() => new FakeValkeyClient())
    const manager = createValkeyConnectionManager(getValkeyConfig({}), factory)

    await expect(manager.connect()).resolves.toBeNull()

    expect(factory).not.toHaveBeenCalled()
    expect(manager.isEnabled()).toBe(false)
    expect(manager.getState()).toBe('disabled')
    expect(manager.getClient()).toBeNull()
  })

  it('creates one centralized client and reuses it', async () => {
    const client = new FakeValkeyClient()
    const factory = vi.fn(() => client)
    const manager = createValkeyConnectionManager(enabledConfig(), factory)

    const first = await manager.connect()
    const second = await manager.connect()

    expect(first).toBe(client)
    expect(second).toBe(client)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(client.connectCalls).toBe(1)
    expect(manager.getState()).toBe('ready')
    expect(getValkeyMetricsSnapshot().lastConnectionState).toBe('ready')
  })

  it('records reconnect and disconnect events without logging secrets', async () => {
    const client = new FakeValkeyClient()
    const manager = createValkeyConnectionManager(enabledConfig({ password: 'do-not-log' }), () => client)

    await manager.connect()
    client.emit('reconnecting')
    await manager.disconnect()

    const metrics = getValkeyMetricsSnapshot()
    expect(metrics.reconnectCount).toBe(1)
    expect(metrics.disconnectCount).toBeGreaterThanOrEqual(1)

    const output = [
      ...vi.mocked(console.info).mock.calls.flat(),
      ...vi.mocked(console.warn).mock.calls.flat(),
      ...vi.mocked(console.error).mock.calls.flat(),
    ].join('\n')
    expect(output).not.toContain('do-not-log')
  })

  it('returns disabled health without executing Valkey commands', async () => {
    const factory = vi.fn(() => new FakeValkeyClient())
    const manager = createValkeyConnectionManager(getValkeyConfig({}), factory)

    const health = await checkValkeyHealth(manager)

    expect(health.status).toBe('disabled')
    expect(health.ping).toBe('skipped')
    expect(factory).not.toHaveBeenCalled()
  })

  it('checks Valkey health, latency, version, memory, and connection state', async () => {
    const client = new FakeValkeyClient()
    client.serverInfo = 'valkey_version:8.0.1\r\nredis_version:7.2.0\r\n'
    client.memoryInfo = 'used_memory:98765\r\n'
    const manager = createValkeyConnectionManager(enabledConfig(), () => client)

    const health = await checkValkeyHealth(manager)

    expect(health.status).toBe('healthy')
    expect(health.enabled).toBe(true)
    expect(health.connectionState).toBe('ready')
    expect(health.ping).toBe('ok')
    expect(health.version).toBe('8.0.1')
    expect(health.memoryUsedBytes).toBe(98765)
    expect(health.latencyMs).toEqual(expect.any(Number))
    expect(getValkeyMetricsSnapshot().lastMemoryUsedBytes).toBe(98765)
  })

  it('handles connection and health failures safely', async () => {
    const client = new FakeValkeyClient()
    client.shouldConnectFail = true
    const manager = createValkeyConnectionManager(enabledConfig(), () => client)

    const health = await checkValkeyHealth(manager)

    expect(health.status).toBe('unhealthy')
    expect(health.ping).toBe('failed')
    expect(health.errors).toEqual(['Valkey health check failed'])
    expect(manager.getState()).toBe('error')
    expect(getValkeyMetricsSnapshot().healthFailureCount).toBe(1)
    expect(getValkeyMetricsSnapshot().commandFailureCount).toBe(1)
  })

  it('creates environment-scoped namespaces and hashes identifiers', () => {
    expect(getValkeyEnvironment({ NODE_ENV: 'production' })).toBe('prod')
    expect(createValkeyKeyPrefix('Health Check', { VALKEY_NAMESPACE_ENV: 'Preview' })).toBe(
      'luxyhub:preview:health-check:'
    )
    expect(createValkeyKey('Health Check', 'Request 1', { VALKEY_NAMESPACE_ENV: 'Preview' })).toBe(
      'luxyhub:preview:health-check:request-1'
    )
    expect(hashValkeyIdentifier('raw-token')).toMatch(/^[a-f0-9]{64}$/)
  })
})
