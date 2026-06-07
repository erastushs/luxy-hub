import type { NextRequest } from 'next/server'

/**
 * Phase 2: ADMIN_API_KEY
 * Single shared secret for administrative operations.
 * Falls back to CRON_SECRET if ADMIN_API_KEY is not set.
 *
 * Phase 3 migration:
 * - Replace with Supabase session validation (getUser())
 * - Add creator ownership checks (creator_id matching)
 * - Keep ADMIN_API_KEY as fallback for service-role operations
 *
 * ⚠️ TEMPORARY — This is not the final auth model.
 * See CDN_ARCHITECTURE.md §5 for full migration path.
 */

export function verifyAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY || process.env.CRON_SECRET

  if (!adminKey) {
    return false
  }

  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return false
  }

  return authHeader === `Bearer ${adminKey}`
}
