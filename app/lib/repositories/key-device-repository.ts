import { supabaseAdmin } from '@/app/lib/supabase'

export type KeyDeviceRow = {
  id: string
  key_id: string
  fingerprint_hash: string
  first_seen_at: string
  last_seen_at: string
  created_at: string
  updated_at: string
}

const KEY_DEVICE_SELECT = 'id, key_id, fingerprint_hash, first_seen_at, last_seen_at, created_at, updated_at'

export async function countDevices(keyId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('key_devices')
    .select('id', { count: 'exact', head: true })
    .eq('key_id', keyId)

  if (error) throw error
  return count ?? 0
}

export async function countDevicesForKeys(keyIds: string[]): Promise<Record<string, number>> {
  if (keyIds.length === 0) return {}

  const { data, error } = await supabaseAdmin
    .from('key_devices')
    .select('key_id')
    .in('key_id', keyIds)

  if (error) throw error

  return (data ?? []).reduce<Record<string, number>>((counts, row) => {
    const keyId = String(row.key_id)
    counts[keyId] = (counts[keyId] ?? 0) + 1
    return counts
  }, {})
}

export async function findDevice(keyId: string, fingerprintHash: string): Promise<KeyDeviceRow | null> {
  const { data, error } = await supabaseAdmin
    .from('key_devices')
    .select(KEY_DEVICE_SELECT)
    .eq('key_id', keyId)
    .eq('fingerprint_hash', fingerprintHash)
    .single()

  if (error) return null
  return data as KeyDeviceRow
}

export async function registerDevice(keyId: string, fingerprintHash: string): Promise<KeyDeviceRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('key_devices')
    .insert({
      key_id: keyId,
      fingerprint_hash: fingerprintHash,
      first_seen_at: now,
      last_seen_at: now,
      updated_at: now,
    })
    .select(KEY_DEVICE_SELECT)
    .single()

  if (error && error.code === '23505') {
    return findDevice(keyId, fingerprintHash)
  }

  if (error) throw error
  return data as KeyDeviceRow
}

export async function updateDeviceLastSeen(deviceId: string): Promise<KeyDeviceRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('key_devices')
    .update({ last_seen_at: now, updated_at: now })
    .eq('id', deviceId)
    .select(KEY_DEVICE_SELECT)
    .single()

  if (error) return null
  return data as KeyDeviceRow
}

export async function listDevices(keyId: string): Promise<KeyDeviceRow[]> {
  const { data, error } = await supabaseAdmin
    .from('key_devices')
    .select(KEY_DEVICE_SELECT)
    .eq('key_id', keyId)
    .order('last_seen_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as KeyDeviceRow[]
}
