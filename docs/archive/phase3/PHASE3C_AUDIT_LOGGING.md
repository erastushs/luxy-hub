# Phase 3C.4 Audit Logging System

Status: Implemented
Last updated: 2026-06-08

## Purpose
Phase 3C.4 introduces an internal audit logging system that records creator actions for security, support, and future compliance. Creator actions are traceable by actor, resource, and action. Metadata is sanitized to prevent PII and credential leakage.

## Scope

Included:
- `audit_logs` table with migration
- Audit repository with sanitized insert and query functions
- Centralized audit service (`logAuditEvent()`)
- Instrumentation of script create/update/delete/visibility flows
- Metadata sanitization (secret stripping, truncation)
- Append-only design with deny-all RLS

Not included:
- Dashboard UI / audit log viewer
- Admin audit inspection UI
- Retention/archival policies
- Real-time audit streaming

---

## Schema

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_role text NOT NULL DEFAULT 'creator'
    CHECK (actor_role IN ('creator', 'admin')),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  resource_slug text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
```

**Migration files:**
- `migrations/005_audit_logs.sql` — UP migration
- `migrations/005_audit_logs_rollback.sql` — DOWN migration

**RLS:** Deny all for `anon` and `authenticated`. Service-role-only access.

---

## Event Catalog

| Action | Resource Type | Trigger | Metadata |
|--------|--------------|---------|----------|
| `script.created` | `script` | POST scripts | name, visibility, version_id |
| `script.updated` | `script` | PATCH scripts | changed fields, has_content_update |
| `script.deleted` | `script` | DELETE scripts | name, visibility (pre-deletion state) |
| `script.visibility_changed` | `script` | Publish/visibility | previous_visibility, new_visibility |

**Future actions** (not yet instrumented):
- `script.version_created` — when content updates auto-create versions
- `auth.login` — user login events
- `auth.logout` — user logout events

---

## Architecture

```
Route Layer (app/api/dashboard/...)
  │
  │ requireAuth() → actor.id, actor.role
  │
  ├─ calls service functions with actorRole
  │
  v
Service Layer (app/lib/services/script-service.ts)
  │
  │ on successful mutation:
  │   logAuditEvent({ actor_id, actor_role, action, ... })
  │
  v
Audit Service (app/lib/services/audit-service.ts)
  │
  │ logAuditEvent() → insertAuditLog() (fire-and-forget)
  │   .catch() swallows errors (audit failures must not block user operations)
  │
  v
Audit Repository (app/lib/repositories/audit-repository.ts)
  │
  │ insertAuditLog() → sanitizeMetadata() → supabaseAdmin.from('audit_logs').insert()
  │
  v
Supabase Postgres → audit_logs table
```

**Fire-and-forget pattern:**
```typescript
export function logAuditEvent(params: AuditEventParams): void {
  insertAuditLog({...}).catch((err) => {
    console.error(`[audit] Async audit log write failed for ${params.action}:`, err)
  })
}
```

Audit log writes are not awaited and errors are caught. A failed audit write never blocks the user operation.

---

## Metadata Sanitization

The `sanitizeMetadata()` function in the audit repository strips sensitive data before persisting:

### Excluded keys (never stored):
- `token`
- `key`
- `api_key`
- `secret`
- `password`
- `authorization`
- `access_token`
- `refresh_token`
- `service_key`
- `content` (script body)

### String truncation:
Values > 512 characters are truncated with `...` suffix.

### Preserved types:
- `string` (≤512 chars) → stored as-is
- `number` → stored as-is
- `boolean` → stored as-is
- `null` → stored as-is
- Objects/arrays → **dropped** (not stored)

---

## Security Review

| Check | Status |
|-------|--------|
| Actor derived from session, not client input | Pass — `actor.id` and `actor.role` from `requireAuth()` |
| No PII leakage | Pass — metadata sanitization strips sensitive keys |
| No auth tokens stored | Pass — `token`, `access_token`, `refresh_token` excluded |
| No service keys stored | Pass — `key`, `api_key`, `service_key` excluded |
| No script content stored | Pass — `content` excluded (script body up to 62KB) |
| Append-only | Pass — only `INSERT` operations, no `UPDATE`/`DELETE` exposed |
| Service-role-only access | Pass — deny-all RLS for anon/authenticated |
| Audit failures are non-blocking | Pass — `logAuditEvent()` swallows errors |
| No route-level audit logic | Pass — all audit logic in service + repository layers |

---

## Testing

Tests in `__tests__/audit-logging.test.ts` (7 tests, all passing):

### script create audit
- Writes audit log with correct actor and action
- Includes metadata with name and visibility

### script update audit
- Writes audit log with actor role
- Tracks which fields changed and content flag

### script delete audit
- Writes audit log with name and visibility before deletion

### visibility change audit
- Records previous and new visibility

Run with:
```bash
npx vitest run
```
Overall: 65 tests across 4 files, all passing.

---

## Files Created
- `migrations/005_audit_logs.sql` — UP migration
- `migrations/005_audit_logs_rollback.sql` — DOWN migration
- `app/lib/repositories/audit-repository.ts` — Audit repository (insert + list + sanitize)
- `app/lib/services/audit-service.ts` — Centralized audit service
- `__tests__/audit-logging.test.ts` — 7 audit tests
- `PHASE3C_AUDIT_LOGGING.md` — This document

## Files Modified
- `app/lib/services/script-service.ts` — Instrumented with `logAuditEvent()` calls in create/update/delete/changeVisibility
- `app/api/dashboard/scripts/route.ts` — Pass `actor.role` to `createScript()`
- `app/api/dashboard/scripts/[slug]/route.ts` — Pass `actor.role` to `updateScript()` and `deleteScript()`
- `app/api/scripts/route.ts` — Pass `actor.role` to `createScript()`
- `app/api/scripts/[slug]/route.ts` — Pass `actor.role` to `updateScript()` and `deleteScript()`
- `app/api/scripts/[slug]/publish/route.ts` — Pass `actor.role` to `changeVisibility()`
- `__tests__/creator-apis.test.ts` — Added `audit-service` mock
- `__tests__/version-apis.test.ts` — Added `audit-service` mock

---

## Retention Assumptions

V1 assumes audit logs are retained indefinitely. Audit row size is bounded by metadata sanitization (< 1KB per row on average). For a platform with hundreds of creators making dozens of daily operations, the audit table grows slowly enough to not require aggressive retention in V1.

Future considerations:
- Partition by month for large-scale deployments
- Configurable retention period (e.g., 90 days, 1 year)
- Admin audit log inspection UI

---

## Remaining Work for Phase 3D (Security Validation)

- [ ] Production isolation validation with two real Supabase Auth users
- [ ] Admin override path verification
- [ ] Rate limit audit trail
- [ ] Supabase RLS policy audit

(End of file)
