# Phase 7 — Access Modes, Keys, and License Authorization Architecture

Status: Active Development Phase / Documentation Approved Before Implementation
Date: 2026-06-11
Scope: Architecture and roadmap only. Do not create migrations, APIs, runtime behavior changes, or loader changes until Phase 7A.1 implementation begins.

## 1. Approved Direction

Phase 7 introduces script access authorization above the existing Secure Delivery architecture. The platform must support three access models:

| Access Mode | Purpose | Authorization |
|---|---|---|
| `public` | Open access | No authorization required |
| `key_required` | Monetized free access | Existing Work.ink key system |
| `license_required` | Paid/premium access | Creator-generated premium license |

Important separation of concerns:

- `visibility` controls script discoverability and public slug availability: `public`, `unlisted`, `private`.
- `access_mode` controls delivery authorization: `public`, `key_required`, `license_required`.

Secure Delivery remains unchanged. Phase 7 only decides whether a delivery session may be created.

## 2. Current Platform Status

| Area | Status |
|---|---|
| Phase 4 | Complete |
| Phase 5 Secure Delivery | Complete |
| Phase 6 Loader Integration / Analytics V1 | Complete |
| Phase 8 Event Platform | Complete, production verified, Roblox verified |
| Phase 7 | Active development phase |

Analytics V1 is complete and uses `script_executions` as the canonical execution event table for secure delivery sessions. Phase 7 should integrate license and key activity into analytics without changing the existing execution-count contract.

## 3. Relationship to Existing System

```text
                 Phase 7 Authorization Layer
       ┌──────────────────────────────────────────┐
       │ access_mode = public                     │
       │ access_mode = key_required               │
       │ access_mode = license_required           │
       └──────────────────────┬───────────────────┘
                              │ gates only session creation
                              v
Phase 5-6 Secure Delivery ┌──────────────────────────┐
                          │ delivery_sessions         │
                          │ delivery_builds           │
                          │ runtime payload delivery  │
                          │ loader bootstrap/runtime  │
                          └──────────────────────────┘
```

Authorization occurs only during:

```text
POST /api/delivery/session
```

Authorization must not occur during:

- `POST /api/delivery/fetch`
- Payload delivery
- Runtime execution
- Event reporting

## 4. Access Mode Design

### 4.1 `public`

Definition:

- No key required.
- Delivery session is created immediately when the script is deliverable and a ready build exists.

Flow:

```text
Loader
  -> POST /api/delivery/session { slug }
  -> create session
  -> success
```

### 4.2 `key_required`

Definition:

- Uses the existing Work.ink-backed key system.
- Intended for monetized free access.
- Existing endpoints remain supported:
  - `/get-key`
  - `/api/generate-key`
  - `/api/validate`
  - `/api/verify-workink`

Flow:

```text
Loader
  -> validate/submit Work.ink key
  -> POST /api/delivery/session { slug, key }
  -> validate existing key system
  -> create session
  -> success
```

The current Work.ink key system is not being replaced. It becomes the implementation of `access_mode = key_required`.

### 4.3 `license_required`

Definition:

- Uses the new premium license system.
- Intended for paid access.
- Creator-generated license keys.
- Assignment/device limits enforced through license assignments.

Flow:

```text
Loader
  -> POST /api/delivery/session { slug, license_key, customer_identifier }
  -> validate license
  -> check or create assignment
  -> create session
  -> success
```

## 5. Planned Schema

### 5.1 `scripts.access_mode`

Planned column:

```sql
access_mode text not null default 'public'
  check (access_mode in ('public', 'key_required', 'license_required'))
```

Recommended indexes:

```sql
create index idx_scripts_access_mode on scripts (access_mode);
create index idx_scripts_creator_access_mode on scripts (creator_id, access_mode);
```

Defaulting existing rows to `public` preserves current delivery behavior.

### 5.2 `licenses`

Required fields:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `script_id` | Licensed script |
| `creator_id` | Owning creator; derived from server session in creator APIs |
| `key_hash` | Hash/HMAC of generated license key; raw key is never stored |
| `max_assignments` | Device/customer assignment limit |
| `status` | `active`, `disabled`, `revoked` |
| `activation_count` | Count of new assignment activations |
| `delivery_count` | Count of successful license-authorized delivery sessions |
| `last_activation_at` | Last time a new assignment was created |
| `last_delivery_at` | Last successful license-authorized delivery session |
| `expires_at` | Nullable expiry timestamp; `NULL` means permanent license |
| `created_at` | Creation timestamp |
| `updated_at` | Update timestamp |

License statuses:

- `active`
- `disabled`
- `revoked`

Do not use a separate `expired` status. Expiry is derived from `expires_at`:

- `expires_at = NULL` means permanent license.
- `expires_at != NULL` means time-limited license.
- A license is expired when `expires_at <= now()`.

Recommended constraints and indexes:

- `key_hash` unique.
- `max_assignments > 0`.
- `status in ('active', 'disabled', 'revoked')`.
- Index `(script_id, status)` for delivery authorization.
- Index `(creator_id, script_id)` for dashboard management.
- Enforce that `creator_id` matches the parent script owner through service checks, RLS, or a composite FK where migration-safe.

### 5.3 `license_assignments`

Required fields:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `license_id` | Parent license |
| `customer_identifier_hash` | Hashed normalized generic customer/device identifier |
| `display_name` | Optional creator-facing label |
| `status` | Assignment lifecycle state |
| `created_at` | Creation timestamp |
| `updated_at` | Update timestamp |

Recommended assignment statuses:

- `active`
- `disabled`
- `revoked`

Recommended constraints and indexes:

- Unique `(license_id, customer_identifier_hash)`.
- Index `(license_id, status)`.
- Index `customer_identifier_hash` for support lookup where needed.

Avoid storing raw customer identifiers when possible. Store hashes for enforcement and use `display_name` for creator-facing identification.

## 6. Customer Identifier Strategy

Customer identifiers remain generic strings. Examples:

- `roblox_user:123456`
- `hwid:abcdef`
- `custom:xyz`

Rules:

- Normalize before hashing.
- Reject empty values.
- Enforce a maximum length.
- Store `customer_identifier_hash` for enforcement.
- Avoid storing raw identifiers unless a future support workflow explicitly requires it.

The generic strategy keeps Phase 7 future-proof across Roblox user IDs, HWIDs, custom customer IDs, external store IDs, and future loader-generated identifiers.

## 7. Delivery Authorization Boundary

The only authorization boundary is `POST /api/delivery/session`.

Recommended internal abstraction:

```ts
authorizeDeliveryAccess({
  script,
  key,
  licenseKey,
  customerIdentifier,
})
```

Expected outcomes:

```text
public
  -> allow

key_required
  -> require key
  -> validate through existing Work.ink key service
  -> allow or deny

license_required
  -> require license_key and customer_identifier
  -> validate license status, expiry, script ownership, assignment limit
  -> allow or deny
```

`/api/delivery/fetch` remains a session-token validation and one-time consumption endpoint. It should not re-check access mode, Work.ink keys, license keys, assignments, or runtime entitlement.

Event reporting uses the existing per-session `event_secret`. It should not perform key/license authorization.

## 8. Work.ink Integration Strategy

The existing Work.ink system remains supported and becomes the foundation of `key_required`.

Preserved behavior:

- `/get-key` continues to direct users through Work.ink.
- `/api/generate-key` continues to generate a key after Work.ink token verification.
- `/api/validate` continues to validate existing keys.
- `/api/verify-workink` continues to verify Work.ink tokens and generate keys.
- `used_workink_tokens` continues to protect against Work.ink token replay.

Phase 7 should not replace this system. Future hardening may add key hashing, script scoping, or creator-specific Work.ink campaigns, but compatibility with existing behavior must be preserved.

## 9. Device Limit Strategy

Device/customer limits are enforced with:

- `licenses.max_assignments`
- `license_assignments`

Supported limits:

- 1 device
- 3 devices
- 5 devices
- Custom integer limits

Enforcement during `POST /api/delivery/session`:

```text
Existing active assignment
  -> allow

Existing disabled/revoked assignment
  -> deny

No assignment
  -> check active assignment count against max_assignments
  -> create active assignment if limit is available
  -> deny if limit is exhausted
```

Assignment creation and limit checks must be atomic to prevent concurrent requests from exceeding `max_assignments`.

## 10. Analytics and Audit

Analytics V1 is complete. Phase 7 should integrate without redefining execution analytics.

License counters:

- `activation_count`: increment only when a new assignment is created.
- `delivery_count`: increment when a license-authorized delivery session is created.
- `last_activation_at`: update when a new assignment is created.
- `last_delivery_at`: update when a license-authorized delivery session is created.

Recommended audit events:

- `license.created`
- `license.updated`
- `license.disabled`
- `license.revoked`
- `license.assignment_created`
- `license.assignment_disabled`
- `license.assignment_revoked`
- `script.access_mode_changed`

Audit logging should follow the existing fire-and-forget pattern. Audit failures must not block creator operations or delivery authorization.

## 11. Roadmap

### Phase 7A.1 — Schema Foundation

- `scripts.access_mode`
- `licenses`
- `license_assignments`
- Constraints, indexes, ownership model, and RLS design

### Phase 7A.2 — Authorization Abstraction

- `authorizeDeliveryAccess()`
- Delivery session request contract for `key`, `license_key`, and `customer_identifier`
- Tests for all access-mode branches before behavior rollout

### Phase 7A.3 — Key Required Mode

- Integrate existing Work.ink key validation into delivery session creation
- Map `access_mode = key_required` to the existing key ecosystem
- Preserve `/get-key`, `/api/generate-key`, `/api/validate`, and `/api/verify-workink`

### Phase 7A.4 — License Services

- Generate license
- Revoke/disable license
- Assignment management
- Hash license keys before storage

### Phase 7A.5 — License Delivery Authorization

- Enforce `access_mode = license_required`
- Validate license status and `expires_at`
- Check/create assignments under `max_assignments`
- Update license activity counters

### Phase 7A.6 — Dashboard & Loader UX

- Access mode selector
- License management UI
- Assignment/device management UI
- Loader support for key and license modes

### Phase 7A.7 — Hardening & Audit

- Audit logs
- Authorization monitoring
- Analytics integration
- Rate-limit and abuse monitoring for key/license attempts

## 12. Migration Strategy

Recommended implementation order:

1. Add schema foundation with default `scripts.access_mode = 'public'`.
2. Add service/repository types without changing delivery behavior.
3. Add authorization abstraction and preserve current public behavior.
4. Integrate `key_required` using existing Work.ink key validation.
5. Add license generation and assignment services.
6. Integrate `license_required` into session creation.
7. Add dashboard and loader UX.
8. Add hardening, audit, and analytics refinements.

Backward compatibility requirements:

- Existing scripts remain `public` unless explicitly changed.
- Existing Work.ink endpoints remain valid.
- Existing secure delivery session/fetch architecture remains unchanged.
- No authorization logic moves into fetch, payload delivery, runtime execution, or event reporting.

## 13. Security Review

Primary controls:

- Gate access before a delivery session exists.
- Store delivery session token hashes only.
- Store premium license key hashes only.
- Preserve rate limiting on `POST /api/delivery/session`.
- Use generic denial responses for invalid credentials where practical.
- Enforce creator ownership for all license management operations.
- Use service-role-only delivery authorization server-side; no direct anonymous database access.

Known limits:

- A valid customer can still share keys or dump memory after runtime execution.
- HWIDs and customer identifiers can be spoofed depending on loader/executor environment.
- License enforcement is an access-control layer, not a tamper-proof DRM system.

Accepted approach:

- Secure Delivery remains the payload protection layer.
- Phase 7 controls who can create sessions.
- Runtime and event layers remain separate from licensing decisions.

## 14. Implementation Readiness

Ready to begin Phase 7A.1 after documentation approval.

Phase 7A.1 must be schema-only foundation work and should not change runtime delivery behavior until the authorization abstraction and access-mode tests are ready.
