# Event Platform

The Event Platform accepts signed runtime events, queues delivery work, and forwards configured notifications such as Discord webhooks.

## Quick Navigation

- Integration guide: `../integration/EVENT_PLATFORM_INTEGRATION.md`.
- Quickstart: `../integration/EVENT_PLATFORM_QUICKSTART.md`.
- Event queue runtime: `../runtime/EVENT_QUEUE.md`.
- Event queue operations: `../operations/EVENT_QUEUE_RUNBOOK.md`.
- API reference: `../api/REFERENCE.md`.

## Common Tasks

| Task | Document |
| --- | --- |
| Send signed runtime events | `../integration/EVENT_PLATFORM_INTEGRATION.md` |
| Build a quick integration | `../integration/EVENT_PLATFORM_QUICKSTART.md` |
| Replay dead letters | `../dashboard/DASHBOARD_WORKFLOWS.md` |
| Operate the worker | `../operations/EVENT_QUEUE_RUNBOOK.md` |
| Monitor failures | `../operations/MONITORING.md` |

## Security Notes

- Event secrets are runtime secrets and must not be logged.
- Event requests are HMAC signed.
- Replay protection uses nonces and session context.
- Webhook credentials are operational secrets.
