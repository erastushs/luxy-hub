import { describe, expect, it } from 'vitest'
import { authorizeDeliveryAccess } from '@/app/lib/services/delivery-authorization-service'
import type { ScriptAccessMode } from '@/app/lib/repositories/script-repository'

function scriptWithAccessMode(accessMode: ScriptAccessMode) {
  return { access_mode: accessMode }
}

describe('delivery authorization service', () => {
  it('authorizes public delivery access', () => {
    expect(authorizeDeliveryAccess({ script: scriptWithAccessMode('public') })).toEqual({
      success: true,
      accessMode: 'public',
    })
  })

  it('returns not implemented for key-required delivery access', () => {
    expect(authorizeDeliveryAccess({ script: scriptWithAccessMode('key_required') })).toEqual({
      success: false,
      status: 501,
      message: 'Delivery access mode not implemented',
    })
  })

  it('returns not implemented for license-required delivery access', () => {
    expect(authorizeDeliveryAccess({ script: scriptWithAccessMode('license_required') })).toEqual({
      success: false,
      status: 501,
      message: 'Delivery access mode not implemented',
    })
  })
})
