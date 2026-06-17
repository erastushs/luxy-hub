import { createHash } from 'node:crypto'
import type { KeyRow } from '@/app/lib/repositories/key-repository'
import {
  countDevices,
  findDevice,
  registerDevice,
  updateDeviceLastSeen,
} from '@/app/lib/repositories/key-device-repository'

export type DeviceFingerprintInput = {
  executorIdentifier?: unknown
  clientIdentifier?: unknown
}

export type DeviceLimitResult =
  | { allowed: true; fingerprintHash: string | null }
  | { allowed: false; message: string; status: number }

const DEVICE_LIMIT_DENIED_MESSAGE = 'Device limit reached'

export async function enforceDeviceLimit(key: Pick<KeyRow, 'id' | 'key_type' | 'max_devices'>, fingerprintInput?: DeviceFingerprintInput): Promise<DeviceLimitResult> {
  const maxDevices = resolveMaxDevices(key)
  if (maxDevices === null) {
    return { allowed: true, fingerprintHash: null }
  }

  const fingerprintHash = createFingerprintHash(fingerprintInput)
  if (!fingerprintHash) {
    return { allowed: false, message: 'Device fingerprint is required', status: 400 }
  }

  const existingDevice = await findDevice(key.id, fingerprintHash)
  if (existingDevice) {
    await updateDeviceLastSeen(existingDevice.id)
    return { allowed: true, fingerprintHash }
  }

  const deviceCount = await countDevices(key.id)
  if (deviceCount >= maxDevices) {
    return { allowed: false, message: DEVICE_LIMIT_DENIED_MESSAGE, status: 403 }
  }

  await registerDevice(key.id, fingerprintHash)
  return { allowed: true, fingerprintHash }
}

export function createFingerprintHash(input?: DeviceFingerprintInput): string | null {
  const executorIdentifier = normalizeIdentifier(input?.executorIdentifier)
  const clientIdentifier = normalizeIdentifier(input?.clientIdentifier)

  if (!executorIdentifier || !clientIdentifier) return null

  return createHash('sha256')
    .update(`${executorIdentifier}\n${clientIdentifier}`)
    .digest('hex')
}

function resolveMaxDevices(key: Pick<KeyRow, 'key_type' | 'max_devices'>): number | null {
  if (key.key_type === 'legacy') return null
  if (typeof key.max_devices === 'number' && key.max_devices > 0) return key.max_devices
  if (key.key_type === 'free' || key.key_type === 'weekly') return 1
  if (key.key_type === 'monthly') return 3
  return null
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
