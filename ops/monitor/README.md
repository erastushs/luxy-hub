# LuxyHub Production Monitor

Operational monitoring toolkit for LuxyHub production rate-limit and delivery session canary rollouts.

This toolkit is read-only. It performs GET requests, reads local process/system status, tails PM2 logs, and reads Valkey INFO output through `redis-cli`. It does not restart services, write to Redis or PostgreSQL, change nginx, change PM2, change deployment configuration, or modify environment variables.

## Requirements

Ubuntu 24.04 with:

- `bash`
- `curl`
- `jq`
- `tmux`
- `redis-cli`
- `pm2`
- `free`
- `uptime`
- `df`
- `awk`
- `node`

If `tmux` is missing, the full dashboard prints installation instructions instead of creating a session.

The default base URL is:

```bash
http://127.0.0.1:3000
```

Override it for one command with:

```bash
LUXYHUB_BASE_URL=https://www.luxyhub.space ops/monitor/monitor.sh
```

Operational monitoring uses `LUXY_MONITOR_TOKEN` and does not depend on Supabase sessions.
You can set it in a local `ops/monitor/.env` file or export it in the current shell:

```bash
LUXY_MONITOR_TOKEN=xxxx ops/monitor/shadow.sh
```

Supported headers:

- `Authorization: Bearer <token>`
- `X-Luxy-Monitor-Token: <token>`

The token is only for operational monitoring endpoints.

## Launch

From the repository root:

```bash
ops/monitor/monitor.sh
```

Direct panels:

```bash
ops/monitor/health.sh
ops/monitor/shadow.sh
ops/monitor/delivery.sh
ops/monitor/system.sh
ops/monitor/logs.sh
ops/monitor/tmux-monitor.sh
```

## Stop

- Single panel: press `Ctrl-C`.
- Logs panel: press `Ctrl-C`.
- tmux dashboard: detach with `Ctrl-b d`.
- Stop the tmux dashboard session:

```bash
tmux kill-session -t "LuxyHub Monitor"
```

## Dashboard Layout

```text
+------------------------------------------+
| Health                                    |
| /api/health                              |
+------------------+-----------------------+
| Rate Limit       | Delivery Sessions     |
| /api/internal/   | /api/internal/        |
| rate-limit-shadow| delivery-session      |
+------------------+-----------------------+
| VPS / Valkey                             |
| host / PM2 / Valkey                      |
+------------------------------------------+
| PM2 Live Logs                            |
| pm2 logs luxyhub                         |
+------------------------------------------+
```

Every pane displays `LuxyHub Production Monitor` and a current refresh timestamp. The tmux session name remains `LuxyHub Monitor`. Stale sessions are destroyed before recreating.

## Panels

### Health

Refreshes every 2 seconds from `/api/health`.

Displays current time, overall status, runtime mode, operational state, observability status, configured canary percentage, effective canary percentage, parity, mismatch rate, fallback count, backend failures, comparison failures, PostgreSQL status, Valkey status, latency delta, speedup, and delivery session health summary.

### Rate Limit

Refreshes every 2 seconds from `/api/internal/rate-limit-shadow` when `LUXY_MONITOR_TOKEN` is configured.

Displays parity, mismatch count, allow parity, deny parity, retry-after parity, backend failures, comparison failures, canary requests, PostgreSQL requests, Valkey requests, effective canary percentage, and average latency delta.

### Delivery Sessions

Refreshes every 2 seconds from `/api/internal/delivery-session` when `LUXY_MONITOR_TOKEN` is configured.

Displays mode, operational state, created/consumed/expired/active sessions, lookup failures, backend failures, comparison failures, fallback count, parity, mismatch rate, Postgres and Valkey average latency, Valkey health, connection state, latency, and memory.

### System

Refreshes every 2 seconds from local read-only commands.

Displays current time, system uptime, load average, CPU usage, memory usage, disk usage, PM2 process status, Node version, Valkey version, Valkey memory, Valkey clients, and Valkey uptime.

### PM2 Live Logs

Streams:

```bash
pm2 logs luxyhub
```

The panel does not suppress ordinary log lines. It highlights operational keywords:

- Red: `ERROR`, `timeout`, `disconnect`
- Yellow: `WARN`, `fallback`, `comparison`, `mismatch`
- Magenta: `lua`, `redis`

## Auth Fallback

If authentication is not configured, authenticated panels print a clean operator message and do not dump raw JSON:

```text
Delivery Session

Monitoring authentication not configured.

Endpoint:
/api/internal/delivery-session

Set:
LUXY_MONITOR_TOKEN=xxxx

or export LUXY_MONITOR_TOKEN before launching this panel.

Supported headers:
Authorization: Bearer <token>
X-Luxy-Monitor-Token: <token>

No authentication bypass is attempted.
```

## Security Notes

- Use at least 32 random bytes for `LUXY_MONITOR_TOKEN`.
- Never commit the token or a populated `ops/monitor/.env` file.
- Rotate the token periodically.
- Never expose the token in logs, screenshots, shared terminals, or public issue reports.

## Color Meanings

- Green: healthy, parity at 100%, fallback count `0`, backend failures `0`, comparison failures `0`, or low host resource usage.
- Yellow: parity between 99% and 100%, degraded status, or elevated host resource usage.
- Red: unhealthy status, fallback count greater than `0`, backend failures greater than `0`, comparison failures greater than `0`, or high host resource usage.

## Rollout Usage

### 1% Rollout

Use the full tmux dashboard. Confirm overall health is healthy, mismatch rate is near zero, backend and comparison failures remain zero, fallback count does not rise, and PM2 logs do not show repeated fallback, mismatch, timeout, disconnect, Redis, Valkey, or Lua errors.

### 50% Rollout

Keep the dashboard open throughout the traffic shift. Watch effective canary percentage, canary requests, PostgreSQL requests, Valkey requests, average latency delta, Valkey memory, Valkey stats, and PM2 process stability.

### 100% Rollout

Confirm runtime mode and operational state match the intended rollout state. Continue watching parity, fallback count, backend failures, comparison failures, Valkey latency, Valkey memory, system memory, disk, CPU load, and application logs.

### Rollback Monitoring

After rollback, use Health, Shadow, Delivery Session, Logs, and System together. Confirm PostgreSQL status is healthy, overall health recovers, fallback and failure counters stop increasing, Valkey instability no longer affects user-visible behavior, and logs settle without new mismatch or comparison failures.
