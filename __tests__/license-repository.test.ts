import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type {
  LicenseAssignmentRow,
  LicenseRow,
} from '@/app/lib/repositories/license-repository'

vi.mock('@/app/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

import { supabaseAdmin } from '@/app/lib/supabase'
import {
  createLicense,
  createLicenseAssignment,
  authorizeLicenseAssignment,
  disableLicense,
  enableLicense,
  getLicenseAssignments,
  getLicenseById,
  getLicensesForScript,
  removeLicenseAssignment,
  revokeLicense,
  incrementLicenseDeliveryCount,
} from '@/app/lib/repositories/license-repository'

type QueryChain = {
  delete: Mock
  insert: Mock
  update: Mock
  select: Mock
  eq: Mock
  order: Mock
  maybeSingle: Mock
  single: Mock
  then: (resolve: (value: { data?: unknown; error: unknown }) => void) => void
}

function mockLicenseRow(overrides: Partial<LicenseRow> = {}): LicenseRow {
  return {
    id: 'license-uuid-1',
    script_id: 'script-uuid-1',
    creator_id: 'creator-uuid-1',
    key_hash: 'a'.repeat(64),
    max_assignments: 1,
    status: 'active',
    activation_count: 0,
    delivery_count: 0,
    last_activation_at: null,
    last_delivery_at: null,
    expires_at: null,
    created_at: '2026-06-11T00:00:00.000Z',
    updated_at: '2026-06-11T00:00:00.000Z',
    ...overrides,
  }
}

function mockAssignmentRow(overrides: Partial<LicenseAssignmentRow> = {}): LicenseAssignmentRow {
  return {
    id: 'assignment-uuid-1',
    license_id: 'license-uuid-1',
    customer_identifier_hash: 'b'.repeat(64),
    display_name: 'Customer 1',
    status: 'active',
    created_at: '2026-06-11T00:00:00.000Z',
    updated_at: '2026-06-11T00:00:00.000Z',
    ...overrides,
  }
}

function createQueryChain(
  data: LicenseRow | LicenseRow[] | LicenseAssignmentRow | LicenseAssignmentRow[] | null,
  error: unknown = null
): QueryChain {
  const chain = {} as QueryChain
  chain.delete = vi.fn(() => chain)
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => ({
    data: Array.isArray(data) ? data[0] ?? null : data,
    error,
  }))
  chain.single = vi.fn(async () => ({
    data: Array.isArray(data) ? data[0] ?? null : data,
    error,
  }))
  chain.then = (resolve) => {
    resolve({ data, error })
  }
  return chain
}

describe('license repository', () => {
  const mockedFrom = supabaseAdmin.from as unknown as Mock
  const mockedRpc = supabaseAdmin.rpc as unknown as Mock

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates license rows with hashed keys only', async () => {
    const row = mockLicenseRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    const result = await createLicense({
      scriptId: 'script-uuid-1',
      creatorId: 'creator-uuid-1',
      keyHash: 'a'.repeat(64),
      maxAssignments: 3,
      expiresAt: null,
    })

    expect(result).toEqual(row)
    expect(mockedFrom).toHaveBeenCalledWith('licenses')
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      script_id: 'script-uuid-1',
      creator_id: 'creator-uuid-1',
      key_hash: 'a'.repeat(64),
      max_assignments: 3,
      status: 'active',
      expires_at: null,
    }))
  })

  it('retrieves licenses by id and script without delivery integration', async () => {
    const row = mockLicenseRow()
    const chain = createQueryChain([row])
    mockedFrom.mockReturnValue(chain)

    await expect(getLicenseById('license-uuid-1')).resolves.toEqual(row)
    expect(chain.eq).toHaveBeenCalledWith('id', 'license-uuid-1')

    await expect(getLicensesForScript('script-uuid-1')).resolves.toEqual([row])
    expect(chain.eq).toHaveBeenCalledWith('script_id', 'script-uuid-1')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('revokes a license by status only', async () => {
    const row = mockLicenseRow({ status: 'revoked' })
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    const result = await revokeLicense('license-uuid-1')

    expect(result).toEqual(row)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'revoked',
    }))
    expect(chain.eq).toHaveBeenCalledWith('id', 'license-uuid-1')
  })

  it('disables and enables license rows by status only', async () => {
    const disabled = mockLicenseRow({ status: 'disabled' })
    const active = mockLicenseRow({ status: 'active' })
    const chain = createQueryChain(disabled)
    mockedFrom.mockReturnValue(chain)

    await expect(disableLicense('license-uuid-1')).resolves.toEqual(disabled)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'disabled',
    }))
    expect(chain.eq).toHaveBeenCalledWith('id', 'license-uuid-1')

    const enableChain = createQueryChain(active)
    mockedFrom.mockReturnValue(enableChain)

    await expect(enableLicense('license-uuid-1')).resolves.toEqual(active)
    expect(enableChain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active',
    }))
    expect(enableChain.eq).toHaveBeenCalledWith('id', 'license-uuid-1')
  })

  it('creates assignments with hashed generic customer identifiers', async () => {
    const row = mockAssignmentRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    const result = await createLicenseAssignment({
      licenseId: 'license-uuid-1',
      customerIdentifierHash: 'b'.repeat(64),
      displayName: 'Customer 1',
    })

    expect(result).toEqual(row)
    expect(mockedFrom).toHaveBeenCalledWith('license_assignments')
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      license_id: 'license-uuid-1',
      customer_identifier_hash: 'b'.repeat(64),
      display_name: 'Customer 1',
      status: 'active',
    }))
  })

  it('authorizes license assignments through atomic capacity RPC', async () => {
    const assignment = mockAssignmentRow()
    mockedRpc.mockResolvedValue({
      data: [{ success: true, created: true, ...assignment }],
      error: null,
    })

    const result = await authorizeLicenseAssignment({
      licenseId: 'license-uuid-1',
      customerIdentifierHash: 'b'.repeat(64),
      displayName: null,
    })

    expect(mockedRpc).toHaveBeenCalledWith('authorize_license_assignment', {
      p_license_id: 'license-uuid-1',
      p_customer_identifier_hash: 'b'.repeat(64),
      p_display_name: null,
    })
    expect(result).toEqual({ success: true, created: true, assignment })
  })

  it('returns capacity exhausted when atomic assignment RPC denies creation', async () => {
    mockedRpc.mockResolvedValue({ data: [{ success: false }], error: null })

    await expect(authorizeLicenseAssignment({
      licenseId: 'license-uuid-1',
      customerIdentifierHash: 'c'.repeat(64),
    })).resolves.toEqual({ success: false, reason: 'capacity_exhausted' })
  })

  it('returns invalid assignment when atomic assignment RPC denies an inactive assignment', async () => {
    mockedRpc.mockResolvedValue({ data: [{ success: false, status: 'disabled' }], error: null })

    await expect(authorizeLicenseAssignment({
      licenseId: 'license-uuid-1',
      customerIdentifierHash: 'c'.repeat(64),
    })).resolves.toEqual({ success: false, reason: 'invalid_assignment' })
  })

  it('lists assignments for a license', async () => {
    const row = mockAssignmentRow()
    const chain = createQueryChain([row])
    mockedFrom.mockReturnValue(chain)

    await expect(getLicenseAssignments('license-uuid-1')).resolves.toEqual([row])
    expect(chain.eq).toHaveBeenCalledWith('license_id', 'license-uuid-1')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('increments delivery counters through service-role RPC helper', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null })

    await expect(incrementLicenseDeliveryCount('license-uuid-1')).resolves.toBeUndefined()

    expect(mockedRpc).toHaveBeenCalledWith('increment_license_delivery_count', {
      p_license_id: 'license-uuid-1',
    })
  })

  it('removes assignments by id', async () => {
    const row = mockAssignmentRow()
    const chain = createQueryChain(row)
    mockedFrom.mockReturnValue(chain)

    await expect(removeLicenseAssignment('assignment-uuid-1')).resolves.toEqual(row)
    expect(mockedFrom).toHaveBeenCalledWith('license_assignments')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'assignment-uuid-1')
    expect(chain.select).toHaveBeenCalled()
    expect(chain.maybeSingle).toHaveBeenCalled()
  })
})
