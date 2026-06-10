# Phase 8 GitHub Actions Scheduler

Status: Implemented
Date: 2026-06-10
Scope: Deployment strategy only

## Why This Exists

Phase 8 queue delivery needs a worker cadence close to every 5 minutes:

```text
/api/internal/event-worker
  -> processEventQueue()
  -> checkAlerts()
```

Vercel Hobby does not support `*/5 * * * *` cron schedules. Keeping the 5-minute event worker on Vercel Cron would require Vercel Pro. The worker is already an authenticated HTTP route, so GitHub Actions can invoke it on a 5-minute schedule without changing queue logic.

## Architecture

```text
GitHub Actions schedule: */5 * * * *
  |
  v
POST $EVENT_WORKER_URL
Authorization: Bearer $CRON_SECRET
  |
  v
/api/internal/event-worker
  |
  |-- processEventQueue()
  |-- checkAlerts()
  |
  v
JSON worker stats + alert result
```

The dedicated `/api/internal/check-alerts` route is preserved for manual invocation, debugging, and future deployments. It is not scheduled separately because the event worker already runs `checkAlerts()` after queue processing.

## Files

| File | Purpose |
|---|---|
| `.github/workflows/event-worker.yml` | Runs the event worker every 5 minutes and supports manual dispatch. |
| `vercel.json` | Keeps only the daily cleanup cron, which is compatible with Vercel Hobby. |
| `app/api/internal/event-worker/route.ts` | Existing worker route; behavior unchanged. |
| `app/api/internal/check-alerts/route.ts` | Existing manual/debug route; behavior unchanged. |

## Required GitHub Secrets

Configure these in GitHub:

`Settings -> Secrets and variables -> Actions -> Repository secrets`

| Secret | Example | Notes |
|---|---|---|
| `EVENT_WORKER_URL` | `https://luxyhub.vercel.app/api/internal/event-worker` | Required production URL. Use the Vercel hostname so GitHub Actions traffic does not pass through Cloudflare Bot Fight Mode. |
| `CRON_SECRET` | same value as Vercel `CRON_SECRET` | Must match the environment variable configured in Vercel. |

No secrets are hardcoded in the workflow.

## Cloudflare Operational Note

GitHub Actions requests to `https://www.luxyhub.space/api/internal/event-worker` can be challenged by Cloudflare Bot Fight Mode or challenge-based WAF rules before they reach Vercel. The production scheduler therefore uses the Vercel hostname directly:

```text
https://luxyhub.vercel.app/api/internal/event-worker
```

No Cloudflare bypass rule is required for the scheduler because Actions traffic does not traverse Cloudflare.

## Setup Instructions

1. Deploy the app with `CRON_SECRET` configured in Vercel.
2. Add `EVENT_WORKER_URL` as a GitHub repository secret.
3. Add `CRON_SECRET` as a GitHub repository secret.
4. Confirm GitHub Actions are enabled for the repository.
5. Open `Actions -> Event Worker Scheduler`.
6. Run `workflow_dispatch` once manually.
7. Confirm the job succeeds and the worker response is returned.
8. Confirm scheduled runs appear every 5 minutes.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `EVENT_WORKER_URL secret is not configured.` | Missing GitHub secret | Add `EVENT_WORKER_URL` in repository Actions secrets. |
| `CRON_SECRET secret is not configured.` | Missing GitHub secret | Add `CRON_SECRET` in repository Actions secrets. |
| HTTP 401 | GitHub secret does not match Vercel `CRON_SECRET` | Re-copy the exact secret value into GitHub and Vercel. |
| HTTP 404 | Worker URL is wrong or deployment is unavailable | Use the full deployed URL ending in `/api/internal/event-worker`. |
| HTTP 500 `CRON_SECRET not configured` | Vercel environment variable is missing | Add `CRON_SECRET` to the Vercel project environment and redeploy. |
| Workflow does not run every 5 minutes | GitHub Actions disabled, repository idle, or schedule delay | Enable Actions. GitHub schedules are best-effort and may run a few minutes late. |

## Migration Path To Vercel Pro

The GitHub Actions scheduler can remain in production indefinitely. If moving to Vercel Pro:

1. Disable or remove `.github/workflows/event-worker.yml`.
2. Add a Vercel cron for `/api/internal/event-worker`:

```json
{
  "path": "/api/internal/event-worker",
  "schedule": "*/5 * * * *"
}
```

3. Keep `/api/internal/check-alerts` unscheduled unless a future alerting design requires a separate cadence.
4. Keep the same `CRON_SECRET`; the worker route authentication does not change.

## Deployment Requirements

Development:

- Vercel Hobby
- GitHub Actions scheduler for `/api/internal/event-worker`
- Vercel daily cleanup cron for `/api/cleanup`

Production:

- GitHub Actions scheduler for `https://luxyhub.vercel.app/api/internal/event-worker`
- Daily cleanup cron remains on Vercel

## Verification

Expected validation commands:

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/event-worker.yml')); print('workflow yaml ok')"
npm run lint
npm run build
```

This migration changes scheduling only. It does not modify queue logic, event processing, alert thresholds, or provider delivery behavior.
