import { createClient } from 'redis'
import { getValkeyConfig, assertServerOnlyValkeyAccess } from './config'
import { logValkeyEvent } from './logger'
import {
  recordValkeyCommandFailure,
  recordValkeyConnection,
  recordValkeyConnectionState,
  recordValkeyDisconnect,
  recordValkeyFailedReconnect,
  recordValkeyReconnect,
  recordValkeyStartupInitialization,
  recordValkeySuccessfulReconnect,
} from './metrics'
import type { ValkeyClient, ValkeyConfig, ValkeyConnectionState } from './types'

type ValkeyClientFactory = (config: ValkeyConfig) => ValkeyClient
type ValkeyListener = (...args: unknown[]) => void

export type ValkeyConnectionManager = {
  isEnabled: () => boolean
  getConfig: () => ValkeyConfig
  getState: () => ValkeyConnectionState
  getClient: () => ValkeyClient | null
  getConnectedSince: () => string | null
  getLastReconnectAt: () => string | null
  connect: () => Promise<ValkeyClient | null>
  disconnect: () => Promise<void>
  shutdown: (reason?: string) => void
}

function createDefaultValkeyClient(config: ValkeyConfig): ValkeyClient {
  const socket = config.tls
    ? {
        host: config.host ?? undefined,
        port: config.port,
        tls: true as const,
        connectTimeout: config.connectTimeoutMs,
        reconnectStrategy: (retries: number) => Math.min(retries * 50, 1000),
      }
    : {
        host: config.host ?? undefined,
        port: config.port,
        connectTimeout: config.connectTimeoutMs,
        reconnectStrategy: (retries: number) => Math.min(retries * 50, 1000),
      }

  return createClient({
    password: config.password ?? undefined,
    database: config.database,
    socket,
  }) as unknown as ValkeyClient
}

export function createValkeyConnectionManager(
  config: ValkeyConfig = getValkeyConfig(),
  clientFactory: ValkeyClientFactory = createDefaultValkeyClient
): ValkeyConnectionManager {
  assertServerOnlyValkeyAccess()

  let client: ValkeyClient | null = null
  let state: ValkeyConnectionState = config.enabled ? 'idle' : 'disabled'
  let connectPromise: Promise<ValkeyClient | null> | null = null
  let connectedSince: string | null = null
  let lastReconnectAt: string | null = null
  let reconnectAttempted = false
  let isShuttingDown = false
  const boundListeners: Array<{ event: string; listener: ValkeyListener }> = []

  if (config.requestedEnabled && !config.enabled) {
    logValkeyEvent('warn', 'configuration_error', {
      errorCount: config.errors.length,
    })
  } else if (!config.enabled) {
    logValkeyEvent('info', 'startup', {
      state,
      action: 'skipping_initialization',
    })
  }

  function setReady(): void {
    state = 'ready'
    connectedSince = new Date().toISOString()
    recordValkeyConnection('ready')
  }

  function removeClientListeners(nextClient: ValkeyClient): void {
    if (!nextClient.off) {
      boundListeners.length = 0
      return
    }

    for (const { event, listener } of boundListeners.splice(0)) {
      nextClient.off(event, listener)
    }
  }

  function bindListener(nextClient: ValkeyClient, event: string, listener: ValkeyListener): void {
    nextClient.on(event, listener)
    boundListeners.push({ event, listener })
  }

  function bindClientEvents(nextClient: ValkeyClient): void {
    bindListener(nextClient, 'connect', () => {
      setReady()
      logValkeyEvent('info', 'connection', { state })
    })

    bindListener(nextClient, 'ready', () => {
      state = 'ready'
      recordValkeyConnectionState('ready')
      if (reconnectAttempted) {
        recordValkeySuccessfulReconnect()
        reconnectAttempted = false
      }
    })

    bindListener(nextClient, 'reconnecting', () => {
      state = 'connecting'
      lastReconnectAt = new Date().toISOString()
      reconnectAttempted = true
      recordValkeyReconnect()
      logValkeyEvent('warn', 'reconnect', { state })
    })

    bindListener(nextClient, 'end', () => {
      state = 'closed'
      recordValkeyDisconnect(isShuttingDown ? 'shutdown' : 'remote_disconnect')
      logValkeyEvent('info', 'disconnect', { state })
    })

    bindListener(nextClient, 'error', () => {
      state = 'error'
      recordValkeyCommandFailure()
      if (reconnectAttempted) {
        recordValkeyFailedReconnect()
      }
      recordValkeyConnectionState('error')
    })
  }

  return {
    isEnabled() {
      return config.enabled
    },
    getConfig() {
      return config
    },
    getState() {
      return state
    },
    getClient() {
      return client
    },
    getConnectedSince() {
      return connectedSince
    },
    getLastReconnectAt() {
      return lastReconnectAt
    },
    async connect() {
      assertServerOnlyValkeyAccess()

      if (!config.enabled) {
        state = 'disabled'
        recordValkeyConnectionState('disabled')
        return null
      }

      if (client?.isOpen || client?.isReady) {
        state = 'ready'
        recordValkeyConnectionState('ready')
        return client
      }

      if (connectPromise) {
        return connectPromise
      }

      state = 'connecting'
      recordValkeyConnectionState('connecting')
      const startedAt = Date.now()
      logValkeyEvent('info', 'startup', {
        state,
        action: 'connecting',
      })

      client = clientFactory(config)
      bindClientEvents(client)

      connectPromise = client
        .connect()
        .then(() => {
          state = 'ready'
          connectedSince = connectedSince ?? new Date().toISOString()
          recordValkeyConnectionState('ready')
          recordValkeyStartupInitialization(Date.now() - startedAt)
          logValkeyEvent('info', 'startup', {
            state,
            action: 'connected',
            initializationMs: Date.now() - startedAt,
          })
          return client
        })
        .catch((error: unknown) => {
          state = 'error'
          const failedClient = client
          client = null
          if (failedClient) {
            removeClientListeners(failedClient)
          }
          recordValkeyCommandFailure()
          recordValkeyConnectionState('error')
          logValkeyEvent('error', 'connection', {
            state,
            action: 'connection_failed_continuing_with_postgres',
            errorName: error instanceof Error ? error.name : 'UnknownError',
          })
          throw error
        })
        .finally(() => {
          connectPromise = null
        })

      return connectPromise
    },
    async disconnect() {
      if (!client) {
        state = config.enabled ? 'closed' : 'disabled'
        recordValkeyConnectionState(state)
        return
      }

      const currentClient = client
      client = null
      removeClientListeners(currentClient)

      try {
        if (currentClient.isOpen || currentClient.isReady) {
          await currentClient.quit()
        } else if (currentClient.disconnect) {
          currentClient.disconnect()
        }
      } finally {
        state = 'closed'
        recordValkeyDisconnect(isShuttingDown ? 'shutdown' : 'manual_disconnect')
        logValkeyEvent('info', 'disconnect', {
          state,
          reason: isShuttingDown ? 'shutdown' : 'manual_disconnect',
        })
      }
    },
    shutdown(reason: string = 'shutdown') {
      if (isShuttingDown) {
        return
      }

      isShuttingDown = true

      void this.disconnect().catch(() => {
        state = 'closed'
        recordValkeyDisconnect(reason)
      })
    },
  }
}

let singletonManager: ValkeyConnectionManager | null = null
let shutdownHandlersRegistered = false
let registeredSignalHandlers: Array<{
  signal: NodeJS.Signals
  handler: (signal: NodeJS.Signals) => void
}> = []

function registerProcessShutdownHandlers(manager: ValkeyConnectionManager): void {
  if (shutdownHandlersRegistered || typeof process === 'undefined' || !process.once) {
    return
  }

  shutdownHandlersRegistered = true

  const handleSignal = (signal: NodeJS.Signals) => {
    manager.shutdown(signal)
  }

  process.once('SIGINT', handleSignal)
  process.once('SIGTERM', handleSignal)
  registeredSignalHandlers = [
    { signal: 'SIGINT', handler: handleSignal },
    { signal: 'SIGTERM', handler: handleSignal },
  ]
}

export function getValkeyConnectionManager(): ValkeyConnectionManager {
  if (!singletonManager) {
    singletonManager = createValkeyConnectionManager()
    registerProcessShutdownHandlers(singletonManager)
  }

  return singletonManager
}

export function resetValkeyConnectionManagerForTests(): void {
  if (typeof process !== 'undefined' && process.off) {
    for (const { signal, handler } of registeredSignalHandlers) {
      process.off(signal, handler)
    }
  }

  singletonManager = null
  shutdownHandlersRegistered = false
  registeredSignalHandlers = []
}
