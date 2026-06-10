# Production Retest Instructions

## Goal
Re-run production validation focused on analytics tracking, cleanup test data, and rate limiting.

## 1. Raw Download Analytics Retest

### Step
Create or use a published script, then request the raw endpoint.

### Command
```bash
curl -i "https://YOUR_DEPLOYED_DOMAIN/api/scripts/YOUR_SLUG/raw"
```

### Verify
- HTTP `200`
- `Content-Type: text/plain; charset=utf-8`
- `Cache-Control: public, max-age=300, s-maxage=3600`
- `script_downloads` receives a new row shortly after the request

### SQL
```sql
select id, script_id, version_id, ip_hash, user_agent_hash, created_at
from script_downloads
where script_id = (select id from scripts where slug = 'YOUR_SLUG')
order by created_at desc;
```

### Pass Criteria
- At least one new row appears after the raw request.
- `ip_hash` is populated.
- No raw IP or user-agent values are stored.

## 2. Cleanup Retest With Valid Rows

### Step
Insert test rows using a valid non-null `script_id` and a real script row.

### SQL
```sql
insert into script_downloads (script_id, version_id, ip_hash, user_agent_hash, created_at)
values (
  (select id from scripts where slug = 'YOUR_SLUG'),
  (select current_version_id from scripts where slug = 'YOUR_SLUG'),
  'old-ip-hash',
  'old-ua-hash',
  now() - interval '91 days'
);
```

### Cleanup Command
```bash
curl -i -X POST "https://YOUR_DEPLOYED_DOMAIN/api/cleanup" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Verify
```sql
select ip_hash, created_at
from script_downloads
where script_id = (select id from scripts where slug = 'YOUR_SLUG')
order by created_at asc;
```

### Pass Criteria
- Old rows are removed.
- Recent rows remain.

## 3. Rate Limiter Verification

### Step
Send repeated requests until the endpoint returns `429`.

### Raw Endpoint
```bash
for i in {1..120}; do curl -s -o /dev/null -w "%{http_code}\n" "https://YOUR_DEPLOYED_DOMAIN/api/scripts/YOUR_SLUG/raw"; done
```

### Metadata Endpoint
```bash
for i in {1..120}; do curl -s -o /dev/null -w "%{http_code}\n" "https://YOUR_DEPLOYED_DOMAIN/api/scripts/YOUR_SLUG"; done
```

### Upload Endpoint
```bash
for i in {1..60}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://YOUR_DEPLOYED_DOMAIN/api/scripts" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"slug":"rate-limit-test-'"$i"'","name":"Rate Limit Test","content":"x"}'; done
```

### Pass Criteria
- At least one request returns `429` for each endpoint under sustained requests.
- `Retry-After` is present on throttled responses.

## 4. Immediate Evidence to Capture
- Raw response headers
- SQL result showing `script_downloads` row creation
- Cleanup before/after row counts
- A rate-limited response with headers

## 5. Decision Rule
- If analytics rows are written and cleanup/rate limiting behave as expected, keep the current implementation and proceed with production readiness review.
- If analytics rows still do not appear, investigate Supabase service-role configuration and deployed RLS/policy state before making any further code changes.
