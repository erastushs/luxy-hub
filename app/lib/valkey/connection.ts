import { createClient } from 'redis'
import { getValkeyConfig, assertServerOnlyValkeyAccess } from './config'
import { logValkeyEvent } from './logger'
import {
  recordValkeyCommandFailure,
  recordValkeyConnection,
  recordValkeyConnectionState,
  recordValkeyDisconnect,
  recordValkeyReconnect,
} from './metrics'
import type { ValkeyClient, ValkeyConfig, ValkeyConnectionState } from './types'

type ValkeyClientFactory = (config: ValkeyConfig) => ValkeyClient

export type ValkeyConnectionManager = {
  isEnabled: () => boolean
  getConfig: () => ValkeyConfig
  getState: () => ValkeyConnectionState
  getClient: () => ValkeyClient | null
  connect: () => Promise<ValkeyClient | null>
  disconnect: () => Promise<void>
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

  if (config.requestedEnabled && !config.enabled) {
    logValkeyEvent('warn', 'configuration_error', {
      errorCount: config.errors.length,
    })
  }

  function bindClientEvents(nextClient: ValkeyClient): void {
    nextClient.on('connect', () => {
      state = 'ready'
      recordValkeyConnection('ready')
      logValkeyEvent('info', 'connection', { state })
    })

    nextClient.on('ready', () => {
      state = 'ready'
      recordValkeyConnectionState('ready')
    })

    nextClient.on('reconnecting', () => {
      state = 'connecting'
      recordValkeyReconnect()
      logValkeyEvent('warn', 'reconnect', { state })
    })

    nextClient.on('end', () => {
      state = 'closed'
      recordValkeyDisconnect()
      logValkeyEvent('info', 'disconnect', { state })
    })

    nextClient.on('error', () => {
      state = 'error'
      recordValkeyCommandFailure()
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

      client = clientFactory(config)
      bindClientEvents(client)

      connectPromise = client
        .connect()
        .then(() => {
          state = 'ready'
          recordValkeyConnectionState('ready')
          return client
        })
        .catch((error: unknown) => {
          state = 'error'
          client = null
          recordValkeyCommandFailure()
          recordValkeyConnectionState('error')
          logValkeyEvent('error', 'connection', {
            state,
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

      try {
        if (currentClient.isOpen || currentClient.isReady) {
          await currentClient.quit()
        } else if (currentClient.disconnect) {
          currentClient.disconnect()
        }
      } finally {
        state = 'closed'
        recordValkeyDisconnect()
      }
    },
  }
}

let singletonManager: ValkeyConnectionManager | null = null

export function getValkeyConnectionManager(): ValkeyConnectionManager {
  if (!singletonManager) {
    singletonManager = createValkeyConnectionManager()
  }

  return singletonManager
}

export function resetValkeyConnectionManagerForTests(): void {
  singletonManager = null
}
