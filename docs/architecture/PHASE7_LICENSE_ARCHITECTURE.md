# Phase 7 — License & Delivery Authorization Architecture

Status: Planning / Architecture Review Required Before Implementation
Date: 2026-06-10
Scope: Architecture and roadmap only. Phase 7 has not started in code. Do not create migrations, APIs, delivery changes, or loader modifications until the review findings in this document are resolved.

## 1. Goals

Introduce a licensing model that sits above the existing secure delivery architecture without modifying it:

- Scripts can be free (no key) or license-required.
- License validation gates delivery session creation.
- Creators manage licenses and customers from the dashboard.
- The build pipeline, encryption, session lifecycle, and loader runtime remain unchanged.

## 2. Architecture Overview

### 2.1 Relationship to Existing System

```
                    Phase 7 (new)
               ┌─────────────────────┐
               │ License Validation   │
               │ Entitlement Check    │
               │ Key Management       │
               └────────┬────────────┘
                        │ gates session creation
                        v
Phase 5-6 (unchanged) ┌─────────────────────┐
                       │ Delivery Session     │
                       │ Build Pipeline       │
                       │ Runtime Payload      │
                       │ Loader Bootstrap     │
                       └─────────────────────┘
```

### 2.2 New Tables (planned)

**`licenses`** — license definitions owned by creators:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `script_id` | uuid | FK to `scripts.id` |
| `creator_id` | uuid | FK to `auth.users.id` |
| `key_prefix` | text | Key format prefix (e.g. `LUXY`) |
| `key_suffix` | text | Unique key suffix (e.g. encrypted random) |
| `key_hash` | text | SHA-256 hash of generated license key; never store raw key after issuance |
| `max_assignments` | int | Max customers per license (null = unlimited) |
| `status` | text | `active`, `revoked`, `expired` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `revoked_at` | timestamptz | Nullable |
| `last_activation_at` | timestamptz | Nullable — last delivery session created |
| `last_delivery_at` | timestamptz | Nullable — last fetch completed |
| `metadata` | jsonb | Optional creator-facing notes/tier labels; not used for authorization decisions |

**`license_assignments`** — customer-to-license bindings:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `license_id` | uuid | FK to `licenses.id` |
| `customer_identifier` | text | Creator-defined customer label |
| `status` | text | `active`, `revoked` |
| `assigned_at` | timestamptz | |
| `revoked_at` | timestamptz | Nullable |

RLS posture:
- `licenses` — owner-aware, same pattern as `scripts`
- `license_assignments` — gated through parent license owner
- Both tables follow existing `deny_all` default + service-role-only operational pattern

## 3. Access Mode Model

Scripts have an access mode that controls whether a license key is required for delivery.

| Mode | Session Creation | Key Required | Behavior |
|------|-----------------|-------------|----------|
| `free` | Proceeds as today | No | Identical to current Phase 6H flow |
| `license_required` | License validation required | Yes (`script_key`) | Valid active license + assignment must exist |

### Default Mode

All existing scripts default to `free`. Creators explicitly opt scripts into `license_required`. Phase 7A implementation should add `scripts.access_mode text not null default 'free' check (access_mode in ('free', 'license_required'))`; this is an additive existing-table migration with no data backfill.

### Mode Ownership

Access mode lives on the script, not on the license. A `license_required` script can have multiple licenses (for example, per-customer keys or future tiers). License records hold key material, assignment limits, and lifecycle state; the script's mode determines whether validation runs. Do not duplicate `access_mode` on `licenses`.

## 4. Delivery Authorization Model

### 4.1 Current Flow (Phase 6H)

```
Loader
  |
  | POST /api/delivery/session { slug }
  v
Delivery Session Service
  |
  | find ready encrypted build
  | create one-time session
  v
session_token + expires_in
  |
  | POST /api/delivery/fetch { session_token }
  v
validate session → decrypt → decompress → runtime payload
```

### 4.2 Licensed Flow (Phase 7C)

```
Loader
  |
  | script_key = "LUXY-XXXX-XXXX"     ← set by executor environment
  |
  | POST /api/delivery/session { slug, script_key }
  v
License Validation                     ← NEW GATE
  |
  | validate key format
  | lookup license by key
  | verify license.status = active
  | verify license.script.access_mode = license_required
  | verify assignment exists and is active
  v
Create Session
  |
  | update last_activation_at
  v
session_token + expires_in
  |
  | POST /api/delivery/fetch { session_token }
  v
validate session → decrypt → decompress → runtime payload
  |
  | update last_delivery_at
  v
```

### 4.3 Free Flow (Unchanged)

```
Loader
  |
  | (no script_key set)
  |
  | POST /api/delivery/session { slug }
  v
License check: script.access_mode = free → SKIP
  |
  v
Create Session → fetch → runtime payload
```

### 4.4 Integration Points

License validation is inserted at exactly one point: **inside `POST /api/delivery/session` after script/build lookup and before session token generation.**

The integration is additive:

- `script_key` is an optional field on the existing session request body.
- Absent `script_key` + `access_mode = free` → proceed as today.
- Present `script_key` + `access_mode = license_required` → validate before session.
- Present `script_key` + `access_mode = free` → ignore key (or reject as misconfiguration; TBD).
- Absent `script_key` + `access_mode = license_required` → deny.

Nothing else changes:
- `/api/delivery/fetch` remains unchanged.
- `/api/loader/[slug]` bootstrap code remains unchanged.
- Build pipeline, encryption, session token hashing, runtime format — all unchanged.

### 4.5 Denial Response

Uniform error for all license failures:

```json
{
  "success": false,
  "message": "Invalid or revoked license"
}
```

This matches the existing `Invalid delivery session` pattern — no oracle for whether the license is missing, expired, or revoked.

## 5. Key Format

License keys use a human-readable prefix format:

```
LUXY-XXXX-XXXX
```

- `LUXY` — fixed prefix for brand recognition
- `XXXX-XXXX` — two groups of four alphanumeric characters
- Generated server-side on license creation
- Hashed in database (SHA-256, same pattern as session tokens)
- Full key shown once to creator on creation; copy workflow available thereafter

The key is **not** a cryptographic secret — it is a lookup identifier. The real security comes from one-time session tokens, rate limiting, and server-side validation. This is consistent with the existing threat model documented in Phase 6H §8.

## 6. Dashboard Management Model

### 6.1 License Lifecycle

```
Create → Active → Revoked
              ↘ Expired (future: time-based)
```

- **Create**: Creator generates a license for a script, receives key once.
- **Edit**: Update max_assignments, metadata.
- **Revoke**: Immediate — all assignments invalidated, all sessions denied.
- **Reset**: Revoke current + generate new key (preserves assignments).
- **Search**: By key, customer identifier, or status.
- **Status**: Active / Revoked / Expired badge per license.

### 6.2 Customer Assignment

- Creator assigns a license to a customer by identifier.
- Customer identifier is creator-defined (e.g., Discord username, email, order ID).
- Revoking an assignment is immediate; revoking the parent license revokes all assignments.
- No self-service customer portal in V1.

### 6.3 Creator UX

Dashboard additions on the script detail page:

- **License Overview Cards**: Count of active, revoked, total licenses per script.
- **Copy Key**: One-click copy of license key.
- **Copy Loader Example**: Snippet with key embedded:

```lua
getgenv().script_key = "LUXY-XXXX-XXXX"

loadstring(game:HttpGet(
    "https://www.luxyhub.space/api/loader/luxy"
))()
```

- **Status Badges**: Active (green), Revoked (red), Expired (yellow).
- **Customer Assignment UI**: Assign, revoke, search customers per license.

## 7. Analytics & Audit

### 7.1 License Activity

Tracked on the `licenses` row:

- `last_activation_at` — updated when a delivery session is created with this license
- `last_delivery_at` — updated when `/api/delivery/fetch` succeeds with a session created under this license

### 7.2 Audit Events

New audit log event types:

- `license.created`
- `license.updated`
- `license.revoked`
- `license.assignment_created`
- `license.assignment_revoked`

Follows existing fire-and-forget audit pattern — audit failures do not block operations.

### 7.3 Revocation History

Stored inline on `licenses.revoked_at`. Full history of revoke/reissue cycles available through audit logs.

## 8. Migration Strategy

### Zero-Downtime Rollout

1. Review and finalize the License / Assignment / Customer Identifier / Entitlement / Delivery Authorization model below.
2. Deploy migration: add `scripts.access_mode`, `licenses`, and `license_assignments`.
3. Deploy code: license service, repository, validators — all behind `scripts.access_mode` check.
4. Existing scripts default to `free`; no backfill or behavior change for current traffic.
5. Creators opt scripts into `license_required` explicitly.

### Backward Compatibility

- All 114 completed tasks continue working.
- All existing tests continue passing.
- `/api/delivery/session` accepts `script_key` as optional — absent means free.
- `/api/loader/[slug]` bootstrap is unchanged.
- Phase 5-6 delivery infrastructure is untouched.

## 9. Future Customer Workflow

### V1 (Phase 7)

- Creator manages everything from dashboard.
- Creator assigns licenses manually by customer identifier.
- Customer receives key out-of-band (Discord, email, etc.).
- Customer sets `script_key` in executor environment before bootstrap.

### Future (Beyond Phase 7)

- Customer self-service portal (redeem key, view status).
- Time-based license expiration.
- HWID binding (executor hardware fingerprint).
- Seat limits (concurrent session tracking).
- Tiered licenses (different scripts under one key).
- License analytics dashboard for customers.

## 10. Security Review

### What License Validation Protects

- Prevents unauthorized executors from receiving a delivery session.
- Revocation is immediate — no cached sessions survive (sessions are 60s TTL, one-time use).
- Key format is not brute-forceable at scale due to rate limiting on session creation (20 req/min/IP).

### What It Does Not Protect

- A valid customer can still dump memory after `loadstring` executes.
- Key sharing between customers (no HWID binding in V1).
- Key leaking through executor environment inspection.

These are accepted tradeoffs consistent with the Phase 6H threat model: the practical protections are session gating, rate limiting, revocation, and future build-time obfuscation.

### No New Attack Surface

- `script_key` is hashed before storage (SHA-256, same pattern as session tokens).
- No raw keys in database.
- Uniform error responses prevent oracle attacks.
- License validation runs server-side only — no client-side license checks.
- No key material shipped to the loader.

## 11. Architecture Decisions Summary

| Decision | Rationale |
|----------|-----------|
| Gate at session creation, not fetch | Fetch path stays simple; denial is cheap (no session created) |
| `script_key` as optional field | Zero overhead for free scripts |
| Key as lookup identifier, not cryptographic secret | Consistent with existing threat model |
| License owned by creator (same as scripts) | Reuses existing ownership enforcement infrastructure |
| No HWID/IP binding in V1 | Complexity deferred; revocation + rate limiting are sufficient first pass |
| Uniform denial response | Prevents oracle attacks (matches existing `Invalid delivery session` pattern) |
| Audit logging fire-and-forget | Matches existing audit system contract |
| Build pipeline, encryption, loader unchanged | License is authorization, not delivery — separation of concerns |

## 12. Conflicts & Risks

### Architecture Review Findings Before Phase 7A

Phase 7 should not start implementation until these model boundaries are settled:

| Area | Finding | Recommendation |
|------|---------|----------------|
| License | The earlier plan mixed access mode into both script and license concepts. | Keep access mode only on `scripts`; keep license records focused on key hash, lifecycle, assignment limit, and script ownership. |
| Assignment | Assignment currently binds a license to a free-form customer label, but the lifecycle semantics are thin. | Define whether an assignment is a seat, customer binding, or activation record before building dashboard UX. Store assignment status and timestamps; keep historical changes in audit logs. |
| Customer Identifier | `customer_identifier` is creator-defined and can contain Discord IDs, email-like strings, or manual labels. | Treat it as creator-scoped opaque text, normalize for lookup only if needed, avoid global uniqueness, and do not use it as an authentication secret. |
| Entitlement | Phase 7 is license-gated delivery authorization, not marketplace/payment entitlement. | Model entitlement as "active license for this script, within assignment rules". Do not introduce paid marketplace, creator earnings, or purchase tables in Phase 7. |
| Delivery Authorization | The clean boundary is delivery session creation. | Validate license before creating `delivery_sessions`; do not add license logic to `/api/delivery/fetch`, payload decryption, build generation, or the loader runtime except passing optional `script_key` into session creation. |

### Current Compatibility

- Phase 7 sits above Phase 5-6 delivery infrastructure.
- Existing `keys` table (Work.ink legacy) is unrelated and should remain untouched unless a later migration explicitly deprecates it.
- No API route collisions — license validation is inside existing session handler.
- There is an intentional additive schema change to `scripts.access_mode`; previous "new tables only" assumptions are obsolete.

### Risks

- **Key sharing**: No HWID binding means keys can be shared. Mitigation: rate limiting, revocation, future HWID binding.
- **Creator confusion**: Creators must understand access modes. Mitigation: dashboard UX with clear mode selector and defaults.
- **License validation latency**: Adds a DB query to session creation. Mitigation: indexed key lookup, single-row query, negligible overhead.
