import type { ScriptAccessMode } from '@/app/lib/repositories/script-repository'
import { validateKey } from '@/app/lib/services/key-service'
import { validateLicense } from '@/app/lib/services/license-service'

type DeliveryAuthorizationScript = {
  id: string
  access_mode: ScriptAccessMode
}

export type DeliveryAuthorizationResult =
  | {
      success: true
      accessMode: 'public' | 'key_required' | 'license_required'
    }
  | {
      success: false
      status: number
      message: string
    }

export async function authorizeDeliveryAccess({
  script,
  key,
  license,
  customerIdentifier,
}: {
  script: DeliveryAuthorizationScript
  key?: unknown
  license?: unknown
  customerIdentifier?: unknown
}): Promise<DeliveryAuthorizationResult> {
  if (script.access_mode === 'public') {
    return { success: true, accessMode: 'public' }
  }

  if (script.access_mode === 'key_required') {
    if (!key) {
      return { success: false, status: 403, message: 'Key is required' }
    }
    const keyResult = await validateKey(key)
    if (!keyResult.valid) {
      return { success: false, status: keyResult.status, message: keyResult.message }
    }
    return { success: true, accessMode: 'key_required' }
  }

  if (script.access_mode === 'license_required') {
    const licenseResult = await validateLicense({
      scriptId: script.id,
      license,
      customerIdentifier,
    })
    if (!licenseResult.success) {
      return { success: false, status: licenseResult.status, message: licenseResult.message }
    }
    return { success: true, accessMode: 'license_required' }
  }

  return {
    success: false,
    status: 501,
    message: 'Delivery access mode not implemented',
  }
}
