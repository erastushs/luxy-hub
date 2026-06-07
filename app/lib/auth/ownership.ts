import { findScriptBySlugForOwner, type ScriptRow } from '@/app/lib/repositories/script-repository'
import type { AuthenticatedUser } from '@/app/lib/auth/session-auth'

export class OwnershipError extends Error {
  status: number

  constructor(message: string = 'Forbidden', status: number = 403) {
    super(message)
    this.name = 'OwnershipError'
    this.status = status
  }
}

export async function getOwnedScript(slug: string, ownerId: string): Promise<ScriptRow | null> {
  return findScriptBySlugForOwner(slug, ownerId)
}

export async function assertScriptOwner(slug: string, ownerId: string): Promise<ScriptRow> {
  const script = await getOwnedScript(slug, ownerId)

  if (!script) {
    throw new OwnershipError('Script not found', 404)
  }

  return script
}

export async function requireOwnership(user: AuthenticatedUser, slug: string): Promise<ScriptRow> {
  return assertScriptOwner(slug, user.id)
}
