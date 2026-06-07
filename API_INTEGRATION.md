# LuxyHub API — Key Validation Integration

API Version: v1
Last Updated: June 2026

## Base URL

```
https://luxyhub.vercel.app
```

All requests use `Content-Type: application/json`.

---

## Health Check

```
GET /api/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-06-07T09:00:00.000Z"
}
```

Use this to verify connectivity before sending validation requests. No authentication required.

---

## Validate Key

```
POST /api/validate
```

**Request body:**
```json
{
  "key": "LUXY-ABCD-EFGH-IJKL"
}
```

### Response Table

| Status | Body / Message | Meaning |
|--------|---------------|---------|
| 200 | `{ "success": true }` | Key valid, script can run |
| 400 | `{ "success": false, "message": "Key is required" }` | Request body missing `key` field |
| 403 | `{ "success": false, "message": "Invalid key" }` | Key format invalid, not found, expired, or disabled |
| 413 | `{ "success": false, "message": "Payload too large" }` | Request body exceeds 64 KB (middleware) |
| 429 | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit exceeded (30 req/min) |
| 500 | `{ "success": false, "message": "Server error" }` | Internal server error |

**Critical change from older versions:** The API returns HTTP 403 with message `"Invalid key"` for all validation failures (not found, expired, disabled). It no longer distinguishes between 400 (format), 404 (not found), or 403 (expired/disabled). This prevents key enumeration attacks. Client-side format validation is still recommended to save API calls.

---

## Key Format

**Pattern:** `LUXY-XXXX-XXXX-XXXX`

**Regex:** `/^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/`

- 4 segments separated by hyphens
- First segment always `LUXY` (case-sensitive, uppercase)
- Remaining 3 segments: exactly 4 uppercase alphanumeric characters each
- Example valid: `LUXY-ABCD-EFGH-IJKL`, `LUXY-0T2L-V9YT-Q1NA`

Validate format **client-side before sending** to reduce wasted API calls.

---

## Rate Limits

| Limit | Window | Scope |
|-------|--------|-------|
| 30 requests | 1 minute | Per IP |

**When rate-limited (HTTP 429):**
- Response body: `{ "success": false, "message": "Too many requests. Please try again later." }`
- Response includes `Retry-After` header with seconds until reset

**Retry-After handling (Luau example):**
```lua
local retryAfter = tonumber(response.Headers["retry-after"])
if retryAfter then
    task.wait(retryAfter)
end
```

---

## Integration Examples

### Roblox Luau — Basic Validation

```lua
local HttpService = game:GetService("HttpService")
local BASE_URL = "https://luxyhub.vercel.app"

local function validateKey(key: string): (boolean, string?)
    -- Client-side format check first
    if not key:match("^LUXY%-[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]%-[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]%-[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]$") then
        return false, "Invalid key format"
    end

    local success, response = pcall(function()
        return syn.request({
            Url = BASE_URL .. "/api/validate",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = HttpService:JSONEncode({ key = key }),
        })
    end)

    if not success then
        return false, "Cannot reach server"
    end

    local status = response.StatusCode

    if status == 200 then
        return true, nil
    elseif status == 400 then
        return false, "Key is required"
    elseif status == 403 then
        return false, "Invalid key"
    elseif status == 429 then
        return false, "Too many requests"
    elseif status == 500 then
        return false, "Server error"
    else
        return false, "Unknown error (HTTP " .. tostring(status) .. ")"
    end
end
```

### Roblox Luau — With Retry Logic

```lua
local HttpService = game:GetService("HttpService")
local BASE_URL = "https://luxyhub.vercel.app"

local MAX_RETRIES = 3

local function validateKeyWithRetry(key: string): (boolean, string?)
    if not key:match("^LUXY%-[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]%-[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]%-[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]$") then
        return false, "Invalid key format"
    end

    for attempt = 1, MAX_RETRIES do
        local success, response = pcall(function()
            return syn.request({
                Url = BASE_URL .. "/api/validate",
                Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = HttpService:JSONEncode({ key = key }),
            })
        end)

        if not success then
            if attempt < MAX_RETRIES then
                task.wait(2 ^ attempt)
                continue
            end
            return false, "Cannot reach server after " .. MAX_RETRIES .. " attempts"
        end

        local status = response.StatusCode

        if status == 200 then
            return true, nil
        elseif status == 429 then
            local retryAfter = tonumber(response.Headers["retry-after"])
            if retryAfter and attempt < MAX_RETRIES then
                task.wait(retryAfter + 1)
            else
                return false, "Rate limited"
            end
        else
            return false, "Validation failed (HTTP " .. tostring(status) .. ")"
        end
    end

    return false, "Max retries exceeded"
end
```

### cURL

```bash
# Health check
curl -s https://luxyhub.vercel.app/api/health

# Validate key
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'

# Validate with verbose (see status code and Retry-After header)
curl -v -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'
```

### Python

```python
import re
import time
import requests

BASE_URL = "https://luxyhub.vercel.app"
KEY_REGEX = re.compile(r"^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$")

def validate_key(key: str, max_retries: int = 3) -> tuple[bool, str | None]:
    if not KEY_REGEX.match(key):
        return False, "Invalid key format"

    for attempt in range(max_retries):
        try:
            resp = requests.post(
                f"{BASE_URL}/api/validate",
                json={"key": key},
                timeout=5,
            )
        except requests.exceptions.Timeout:
            return False, "Request timed out"
        except requests.exceptions.ConnectionError:
            return False, "Cannot connect to server"
        except requests.RequestException:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            return False, "Network error after retries"

        status = resp.status_code

        if status == 200:
            return True, None
        elif status == 429:
            retry_after = int(resp.headers.get("Retry-After", 60))
            if attempt < max_retries - 1:
                time.sleep(retry_after + 1)
                continue
            return False, "Rate limited"
        elif status == 400:
            return False, "Key is required"
        elif status == 403:
            return False, "Invalid key"
        elif status == 500:
            return False, "Server error"
        else:
            return False, f"Unexpected status {status}"

    return False, "Max retries exceeded"
```

### Node.js / TypeScript

```typescript
const BASE_URL = 'https://luxyhub.vercel.app'
const KEY_REGEX = /^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

interface ValidationResult {
  valid: boolean
  error?: string
}

async function validateKey(
  key: string,
  maxRetries: number = 3
): Promise<ValidationResult> {
  if (!KEY_REGEX.test(key)) {
    return { valid: false, error: 'Invalid key format' }
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${BASE_URL}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.status === 200) {
        return { valid: true }
      }

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('Retry-After') || '60',
          10
        )
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000))
          continue
        }
        return { valid: false, error: 'Rate limited' }
      }

      switch (response.status) {
        case 400:
          return { valid: false, error: 'Key is required' }
        case 403:
          return { valid: false, error: 'Invalid key' }
        case 500:
          return { valid: false, error: 'Server error' }
        default:
          return { valid: false, error: `Unexpected status ${response.status}` }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { valid: false, error: 'Request timed out' }
      }
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
        continue
      }
      return { valid: false, error: 'Network error after retries' }
    }
  }

  return { valid: false, error: 'Max retries exceeded' }
}
```

---

## Best Practices

### 1. Cache validation results

Do not call `/api/validate` every frame. Validate once on script start and cache:

```lua
local keyValid = false
local keyChecked = false

local function isKeyValid(): boolean
    if not keyChecked then
        local ok, _ = validateKey(storedKey)
        keyValid = ok
        keyChecked = true
    end
    return keyValid
end
```

### 2. Client-side format validation first

Check the key format regex before sending. Saves API calls for obviously malformed keys.

### 3. Implement exponential backoff for retries

On 429 or network failures, wait `2^attempt` seconds before retrying (2s, 4s, 8s). Respect the `Retry-After` header when present.

### 4. Never hardcode API keys

Keys should come from user input, configuration files, or environment variables. Never ship a script with a baked-in key.

### 5. Graceful degradation

If the API is unreachable, block the script rather than allowing execution. Never skip validation on failure.

### 6. Set HTTP timeouts

Always set a timeout (5 seconds recommended) so a downed server does not hang the script indefinitely.

---

## Error Handling Flowchart

```
                   ┌───────────────────┐
                   │ Script starts     │
                   └────────┬──────────┘
                            │
                            ▼
                   ┌───────────────────┐
                   │ User enters key   │
                   └────────┬──────────┘
                            │
                            ▼
                   ┌───────────────────┐     ┌──────────────────────┐
                   │ Client-side regex │────▶│ Invalid key format   │
                   │ check             │ NO  │ Stop.                │
                   └────────┬──────────┘     └──────────────────────┘
                            │ YES
                            ▼
                   ┌───────────────────┐
                   │ POST /api/validate│
                   └────────┬──────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ HTTP 200   │   │ HTTP 429   │   │ Network    │
   │ ✓ Valid    │   │ Rate limit │   │ error      │
   └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
         │                │                │
         ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ Run script │   │ Retry with │   │ Retry with │
   │            │   │ Retry-After│   │ backoff    │
   └────────────┘   └────────────┘   └────────────┘

   ┌──────────────────────────────────────────────┐
   ▼                ▼                             │
HTTP 400        HTTP 403                          │
Missing key     Invalid key                       │
────► Stop      (not found/expired/disabled)      │
                 ────► Stop                       │
                                                   │
   ┌──────────────────────────────────────────────┘
   ▼
HTTP 500
Server error
────► Stop
```

**Note:** HTTP 404 is no longer returned. All validation failures use HTTP 403.

---

## CDN Integration

### Upload Script

```bash
curl -s -X POST https://luxyhub.vercel.app/api/scripts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{
    "slug": "my-script",
    "name": "My Script",
    "description": "An example Roblox script",
    "visibility": "public",
    "content": "print(\"Hello from LuxyHub CDN\")"
  }'
```

**JavaScript:**
```javascript
const response = await fetch('https://luxyhub.vercel.app/api/scripts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
  },
  body: JSON.stringify({
    slug: 'my-script',
    name: 'My Script',
    description: 'An example Roblox script',
    visibility: 'public',
    content: 'print("Hello from LuxyHub CDN")',
  }),
})

const data = await response.json()
if (data.success) {
  console.log('Script created:', data.script.slug)
  console.log('Version ID:', data.script.current_version_id)
}
```

### Update Script

```bash
curl -s -X PATCH https://luxyhub.vercel.app/api/scripts/my-script \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{
    "name": "My Script v2",
    "content": "print(\"Updated script\")"
  }'
```

**JavaScript:**
```javascript
const response = await fetch(
  'https://luxyhub.vercel.app/api/scripts/my-script',
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
    },
    body: JSON.stringify({
      name: 'My Script v2',
      content: 'print("Updated script")',
    }),
  }
)
```

**Note:** When `content` changes, a new version is auto-created (`1.0.0` → `1.0.1`). The `current_version_id` is updated automatically.

### Change Visibility

```bash
curl -s -X POST https://luxyhub.vercel.app/api/scripts/my-script/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"visibility": "public"}'
```

**JavaScript:**
```javascript
await fetch('https://luxyhub.vercel.app/api/scripts/my-script/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
  },
  body: JSON.stringify({ visibility: 'public' }),
})
```

### Raw Endpoint (Script Delivery)

```bash
# Get raw script content (replaces GitHub Raw)
curl -s https://luxyhub.vercel.app/api/scripts/my-script/raw
```

**Roblox Luau — Load Script from CDN:**
```lua
local HttpService = game:GetService("HttpService")
local CDN_BASE = "https://luxyhub.vercel.app"

local function loadScript(slug: string)
    local success, response = pcall(function()
        return syn.request({
            Url = CDN_BASE .. "/api/scripts/" .. slug .. "/raw",
            Method = "GET",
        })
    end)

    if not success or response.StatusCode ~= 200 then
        return nil, "Failed to load script: " .. slug
    end

    local fn, err = loadstring(response.Body)
    if not fn then
        return nil, "Script compile error: " .. (err or "unknown")
    end

    return fn, nil
end

-- Load and execute
local scriptFn, err = loadScript("bloxatlas")
if scriptFn then
    scriptFn()
else
    warn("Script load failed:", err)
end
```

**Roblox Luau — Load with Key Validation:**
```lua
local HttpService = game:GetService("HttpService")
local BASE_URL = "https://luxyhub.vercel.app"

local function validateAndLoad(key: string, scriptSlug: string)
    -- Step 1: Validate key
    local success, response = pcall(function()
        return syn.request({
            Url = BASE_URL .. "/api/validate",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = HttpService:JSONEncode({ key = key }),
        })
    end)

    if not success or response.StatusCode ~= 200 then
        return nil, "Key validation failed"
    end

    -- Step 2: Load script from CDN
    local scriptSuccess, scriptResponse = pcall(function()
        return syn.request({
            Url = BASE_URL .. "/api/scripts/" .. scriptSlug .. "/raw",
            Method = "GET",
        })
    end)

    if not scriptSuccess or scriptResponse.StatusCode ~= 200 then
        return nil, "Script loading failed"
    end

    local fn, err = loadstring(scriptResponse.Body)
    if not fn then
        return nil, "Script compile error: " .. (err or "unknown")
    end

    return fn, nil
end
```

**JavaScript — Load Script:**
```javascript
async function loadScript(slug) {
  const response = await fetch(
    `https://luxyhub.vercel.app/api/scripts/${slug}/raw`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }

  return response.text()
}

const content = await loadScript('bloxatlas')
console.log(content)
```

### Analytics

```bash
curl -s https://luxyhub.vercel.app/api/scripts/my-script/stats
```

**JavaScript:**
```javascript
const response = await fetch(
  'https://luxyhub.vercel.app/api/scripts/my-script/stats'
)
const data = await response.json()

if (data.success) {
  console.log('Total downloads:', data.stats.total_downloads)
  console.log('Unique users:', data.stats.unique_ips)
  console.log('Downloads today:', data.stats.downloads_today)
  console.log('Last download:', data.stats.last_downloaded_at)
}
```

### List Public Scripts

```bash
curl -s "https://luxyhub.vercel.app/api/scripts?limit=10&offset=0"
```

**JavaScript:**
```javascript
async function listScripts(limit = 20, offset = 0) {
  const url = new URL('https://luxyhub.vercel.app/api/scripts')
  url.searchParams.set('limit', limit)
  url.searchParams.set('offset', offset)

  const response = await fetch(url)
  const data = await response.json()

  if (data.success) {
    console.log(`Showing ${data.scripts.length} of ${data.total} scripts`)
    return data.scripts
  }
  return []
}
```

### Delete Script

```bash
curl -s -X DELETE https://luxyhub.vercel.app/api/scripts/my-script \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

---

## CDN Rate Limits

| Endpoint | Window | Limit | Auth |
|----------|--------|-------|------|
| `GET /api/scripts` | 1 minute | 30 | None |
| `POST /api/scripts` | 1 hour | 30 | Bearer |
| `GET /api/scripts/[slug]` | 1 minute | 60 | None |
| `PATCH /api/scripts/[slug]` | 1 hour | 60 | Bearer |
| `DELETE /api/scripts/[slug]` | — | Unlimited | Bearer |
| `POST /api/scripts/[slug]/publish` | 1 hour | 60 | Bearer |
| `GET /api/scripts/[slug]/raw` | 1 minute | 100 | None |
| `GET /api/scripts/[slug]/stats` | 1 minute | 30 | None |

---

## Breaking Changes from Older Versions

| Change | Old | New |
|--------|-----|-----|
| Validate error codes | 400 (format), 404 (not found), 403 (expired/disabled) | 400 (missing key), 403 (all other failures) |
| Base URL | `https://luxyhub.space`, `https://api.luxyhub.space` | `https://luxyhub.vercel.app` |
| Response envelope | `{ "success": true, "data": { ... } }` | `{ "success": true }` (flat) |
| Key generation | `POST /api/generate` with `checkpoint_token` | `POST /api/generate-key` or `POST /api/verify-workink` with `token` |
| Key type field | `key_type` query param | Removed (not implemented) |
| Error codes in body | `{ "code": "INVALID_KEY" }` | Removed (not implemented) |
