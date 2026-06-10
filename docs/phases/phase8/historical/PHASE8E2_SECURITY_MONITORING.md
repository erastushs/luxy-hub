# Phase 8E.2 — Security Monitoring Dashboard

Status: Implemented
Date: 2026-06-10
Scope: Creator-facing security monitoring and anomaly detection dashboard

## Scope Boundary

Implemented:

- `/dashboard/scripts/[slug]/security` — Script-level security dashboard (owner-only)
- Security overview cards (invalid signatures, replay attempts, rate limit hits, auth failures, security score)
- Security trend charts (24h, 7d, 30d) for all four security metrics
- Risk classification (LOW/MEDIUM/HIGH) with weighted scoring
- Anomaly detection (2× moderate, 3× high, zero-baseline spikes)
- Security events table (paginated, sorted by count descending, severity-labeled)
- `auth_failure` counter tracked in `reportEvent()` (pre-session and session-level auth failures)
- Safe DTOs — no `event_secret`, `session_id`, `nonce`, `webhook_url`, `creator_id` exposed
- Service layer with ownership enforcement via `getOwnedScript()`

Not implemented:

- Discord alert delivery
- Email alerts
- Telegram alerts
- License system analytics
- HWID/key system analytics

## Navigation

```
Dashboard
└── Scripts
    └── [slug]
        └── Security
```

Route: `/dashboard/scripts/[slug]/security`

## Risk Model

### Security Score (0-100, higher = better)

Weighted penalty system:

| Metric | Penalty per Event |
|---|---|
| `event.invalid_signature` | 5 |
| `event.replay_attempt` | 10 |
| `event.rate_limited` | 3 |
| `event.auth_failure` | 2 |

Score = `max(0, 100 - sum(penalties))`, capped at 0.

### Risk Classification Thresholds

| Score Range | Risk Level | Color |
|---|---|---|
| ≥ 80 | LOW | emerald |
| 50-79 | MEDIUM | amber |
| < 50 | HIGH | red |

### Risk Trigger Rules

| Trigger | Condition |
|---|---|
| Replay attempts detected | Any `event.replay_attempt` > 0 |
| High invalid signature volume | `event.invalid_signature` ≥ 20 |
| Frequent rate limiting | `event.rate_limited` ≥ 10 |
| Elevated auth failures | `event.auth_failure` ≥ 30 |

## Anomaly Detection Rules

Baseline: counts from the 24h-48h prior window (48h count minus 24h count).

| Detection Rule | Threshold | Severity |
|---|---|---|
| Zero-baseline spike | `current ≥ 5`, baseline = 0 | MEDIUM (HIGH if ≥ 15) |
| 2× spike | `current/baseline ≥ 2`, `current ≥ 5` | MEDIUM |
| 3× spike | `current/baseline ≥ 3`, `current ≥ 10` | HIGH |
| Below threshold | `current < 3` | No anomaly |

## Aggregation Model

All data comes from `verification_logs`:

```sql
SELECT count(*) FROM verification_logs
WHERE event = $metric AND created_at >= $since
```

Metrics tracked:
- `event.invalid_signature`
- `event.replay_attempt`
- `event.rate_limited`
- `event.auth_failure`

Time windows: 24h (overview + trends), 7d (trends), 30d (trends + events table), 48h (baseline for anomaly detection).

## UI Components

| Component | Purpose |
|---|---|
| `SecurityOverviewCards` | 5-card grid: invalid sigs, replay attempts, rate limits, auth failures, security score |
| `SecurityTrendChart` | SVG bar chart for 4 metrics per time window |
| `SecurityRiskCard` | Risk level badge, score, explanation, triggers |
| `SecurityAnomalyCard` | Anomaly list or empty state with shield icon |
| `SecurityEventsTable` | Paginated table with severity dot, event type, count, relative last seen |
| `SecurityClient` | Wrapper composing all components |

### Design Conventions

- Dark theme (zinc-950, zinc-800 borders)
- Lucide-react icons (Shield, Ban, ShieldAlert, Zap, AlertTriangle, TrendingUp)
- Mobile responsive (grid-cols-1 → sm/lg/xl breakpoints)
- Empty states with centered icons and explanatory text
- Color-coded severity: emerald (LOW), amber (MEDIUM), red (HIGH)

## auth_failure Recording

`event.auth_failure` is recorded in `reportEvent()` at the following points:

| Failure Point | Message |
|---|---|
| Invalid session ID format | `invalid session_id format` |
| Invalid timestamp | `invalid timestamp` |
| Timestamp skew > 300s | `timestamp skew` |
| Invalid nonce format | `invalid nonce` |
| Invalid signature format | `invalid signature format` |
| Session not found, no event_secret, or expired | `invalid or expired session` |

Note: HMAC comparison failures are recorded as `event.invalid_signature`, not `event.auth_failure`.

## Files

| File | Change |
|---|---|
| `app/lib/services/event-monitoring-service.ts` | Added `event.auth_failure` to `SecurityMetric` type |
| `app/lib/services/event-reporting-service.ts` | Records `event.auth_failure` at 6 pre-session/auth failure points |
| `app/lib/services/security-monitoring-service.ts` | **Created** — safe DTOs, weighted scoring, risk classification, anomaly detection, trend aggregation |
| `app/dashboard/scripts/[slug]/security/page.tsx` | **Created** — server component (auth → ownership → security fetch) |
| `app/dashboard/scripts/[slug]/security/security-client.tsx` | **Created** — 6 client components (5 cards + wrapper) |
| `app/dashboard/scripts/[slug]/security/loading.tsx` | **Created** — skeleton loading state |
| `__tests__/security-monitoring-service.test.ts` | **Created** — 27 tests |
| `PHASE8E2_SECURITY_MONITORING.md` | **Created** — this document |

## Tests

27 tests covering:

- **Ownership (3)**: 404 for non-owned, existence not leaked, slug+userId resolution
- **Aggregation accuracy (2)**: zero state, multi-window metric aggregation
- **Risk classification (4)**: LOW/MEDIUM/HIGH thresholds, trigger descriptions
- **Anomaly detection (3)**: 3× spike detection, zero-baseline spike, below-threshold no-anomaly
- **Security score (3)**: perfect 100, replay penalty, 0 cap
- **DTO safety (5)**: no event_secret, webhook_url, session_id, nonce, creator_id
- **Pagination (2)**: page 1 metadata, correct total pages
- **Event severity (3)**: HIGH/ replay, MEDIUM invalid_signature and rate_limited, LOW auth_failure
- **Empty state (2)**: empty anomalies, empty events

## Security Review

### No Secrets

- All DTOs are counts and labels — no cryptographic material, session identifiers, or webhook URLs.
- `verification_logs` only exposes `event`, `created_at`, `message`, `ip` — all fields used are benign.
- Service function receives only `slug`, `userId`, `page`, `pageSize`.

### Ownership

- `getSecurityDashboard()` gates on `getOwnedScript(slug, userId)`.
- Non-owners receive `{ success: false, message: 'Script not found', status: 404 }`.

### Read-Only

The security dashboard:
- Does not create/modify/delete any rows
- Does not call any provider delivery code
- Does not trigger queue processing
- Does not expose credentials

### auth_failure as Attack Signal

`event.auth_failure` captures all pre-HMAC failures: bad session format, bad timestamps, bad nonces/signatures, and expired/missing sessions. These are attack surface signals — a spike in auth failures indicates probing or fuzzing attempts.

## Dependencies

### Depends on (reads)

- `app/lib/auth/ownership` → `getOwnedScript()`
- `app/lib/supabase` → `supabaseAdmin` (for `verification_logs` queries)
- `app/lib/services/event-monitoring-service` → `SecurityMetric` types (for `event.auth_failure`)
- `app/lib/services/event-reporting-service` → records `event.auth_failure` counter
- `app/dashboard/components/ErrorBanner` → error display

### No changes to

- Event API (`/api/events/report`)
- Queue worker (`/api/internal/event-worker`)
- Discord provider
- Delivery sessions
- License system
- Loader system
- Event analytics dashboard

## Success Criteria

- [x] Creator can view security posture for owned scripts
- [x] Security overview cards visible (invalid sigs, replays, rate limits, auth failures, score)
- [x] Security trends visible for 24h, 7d, and 30d windows
- [x] Risk classification functional (LOW/MEDIUM/HIGH) with weighted scoring
- [x] Anomaly detection detects 2× and 3× spikes
- [x] Security events table paginated with severity labels
- [x] `auth_failure` counter tracked in reportEvent
- [x] No secrets exposed in any DTO or component
- [x] No alerting implemented (per scope boundary)
- [x] Ownership enforced at service layer
- [x] 27 tests: ownership, aggregation, risk, anomaly, DTO safety, empty state, pagination
- [x] Build (34 files, 402 tests), lint (0 errors), and full test suite pass
