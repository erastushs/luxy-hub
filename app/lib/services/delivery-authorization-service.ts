import type { ScriptAccessMode } from '@/app/lib/repositories/script-repository'

type DeliveryAuthorizationScript = {
  access_mode: ScriptAccessMode
}

export type DeliveryAuthorizationResult =
  | {
      success: true
      accessMode: 'public'
    }
  | {
      success: false
      status: number
      message: string
    }

export function authorizeDeliveryAccess({
  script,
}: {
  script: DeliveryAuthorizationScript
}): DeliveryAuthorizationResult {
  if (script.access_mode === 'public') {
    return { success: true, accessMode: 'public' }
  }

  return {
    success: false,
    status: 501,
    message: 'Delivery access mode not implemented',
  }
}
