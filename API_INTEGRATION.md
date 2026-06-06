# LuxyHub API — Key Validation Integration

API Version: v1
Last Updated: June 2026

## Base URL

```
https://luxyhub.space"
```

All requests use `Content-Type: application/json`.

---

## Health Check

```
GET /api/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-06-07T01:30:00Z"
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

| Status | Body / Message                                                                  | Arti / Meaning                                                                 |
| ------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 200    | `{ "success": true }`                                                           | Key valid, script boleh jalan / key is valid, script can run                   |
| 400    | `{ "success": false, "message": "Key is required" }`                            | Body tidak mengirim field `key` / request body missing `key` field             |
| 400    | `{ "success": false, "message": "Invalid key format" }`                         | Format key tidak cocok regex / key format does not match `LUXY-XXXX-XXXX-XXXX` |
| 404    | `{ "success": false, "message": "Invalid key" }`                                | Key tidak ditemukan di database / key not found in database                    |
| 403    | `{ "success": false, "message": "Key expired" }`                                | Key sudah lewat masa berlaku / key past expiration date                        |
| 403    | `{ "success": false, "message": "Key disabled" }`                               | Key dinonaktifkan (banned / revoked) / key disabled by admin                   |
| 429    | `{ "success": false, "message": "Too many requests. Please try again later." }` | Rate limit tercapai (30 req/menit) / rate limit hit (30 req/min)               |
| 500    | `{ "success": false, "message": "Server error" }`                               | Internal server error, coba lagi nanti / try again later                       |

**Critical difference from old spec:** The API **does not** wrap responses in a `data` envelope. Success is `{ "success": true }` — flat, no nested object. All responses are JSON objects with `success` (boolean) and optionally `message` (string) fields.

---

## Key Format

**Pattern:**

```
LUXY-XXXX-XXXX-XXXX
```

**Regex:**

```
/^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
```

- 4 segments separated by hyphens
- First segment always `LUXY`
- Remaining 3 segments: exactly 4 uppercase alphanumeric characters each
- Example valid: `LUXY-ABCD-EFGH-IJKL`
- Example invalid: `luxy-abcd-efgh-ijkl` (lowercase), `LUXY-ABC-DEFG-HIJK` (wrong segment length)

Validate format **client-side before sending** to reduce wasted API calls.

---

## Rate Limits

| Limit       | Window   | Scope  |
| ----------- | -------- | ------ |
| 30 requests | 1 minute | Per IP |

**When rate-limited (HTTP 429):**

- Response body: `{ "success": false, "message": "Too many requests. Please try again later." }`
- Response includes `Retry-After` header with seconds until the limit resets

**Retry-After handling:**

```lua
local retryAfter = tonumber(response.Headers["retry-after"])
if retryAfter then
    task.wait(retryAfter)
end
```

---

## Integration Examples

### a) Roblox Luau — Basic Validation (syn.request)

```lua
local HttpService = game:GetService("HttpService")
local BASE_URL = "https://luxyhub.space"

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
        return false, "Network error: tidak bisa konek ke server / cannot reach server"
    end

    local status = response.StatusCode

    local data = HttpService:JSONDecode(response.Body)

    if status == 200 then
        return true, nil
    elseif status == 400 then
        if data.message == "Key is required" then
            return false, "Key harus diisi / key is required"
        else
            return false, "Format key salah / invalid key format"
        end
    elseif status == 404 then
        return false, "Key tidak valid / invalid key"
    elseif status == 403 then
        if data.message == "Key expired" then
            return false, "Key sudah expired / key expired"
        else
            return false, "Key dinonaktifkan / key disabled"
        end
    elseif status == 429 then
        return false, "Terlalu banyak request, coba lagi nanti / too many requests"
    elseif status == 500 then
        return false, "Server error, coba lagi nanti / server error"
    else
        return false, "Unknown error (HTTP " .. tostring(status) .. ")"
    end
end

-- Usage
local valid, err = validateKey("LUXY-ABCD-EFGH-IJKL")
if valid then
    print("Key valid, running script...")
else
    warn("Validation failed:", err)
end
```

### b) Roblox Luau — With Retry Logic for Rate Limiting

```lua
local HttpService = game:GetService("HttpService")
local BASE_URL = "https://luxyhub.space"

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
                task.wait(2 ^ attempt) -- Exponential backoff: 2s, 4s, 8s
                continue
            end
            return false, "Network error: tidak bisa konek / unreachable after " .. MAX_RETRIES .. " attempts"
        end

        local status = response.StatusCode

        if status == 200 then
            return true, nil
        elseif status == 429 then
            local retryAfter = tonumber(response.Headers["retry-after"])
            if retryAfter and attempt < MAX_RETRIES then
                task.wait(retryAfter + 1) -- Wait Retry-After seconds + 1s buffer
            else
                return false, "Rate limited, coba lagi nanti / rate limited"
            end
        else
            -- Non-retryable errors
            local data = HttpService:JSONDecode(response.Body)
            if status == 400 then
                return false, "Format key salah / invalid format"
            elseif status == 404 then
                return false, "Key tidak valid / invalid key"
            elseif status == 403 then
                if data.message == "Key expired" then
                    return false, "Key expired / sudah expired"
                else
                    return false, "Key disabled / dinonaktifkan"
                end
            elseif status == 500 then
                return false, "Server error"
            else
                return false, "Error (HTTP " .. tostring(status) .. ")"
            end
        end
    end

    return false, "Max retries exceeded"
end
```

### c) Roblox Luau — UI Feedback (PlayerAdded, show errors to user)

```lua
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local BASE_URL = "https://luxyhub.space"

-- Assumes you have a ScreenGui with a TextLabel named "StatusLabel"
-- and a TextBox for key input named "KeyInput"
local screenGui = script.Parent -- or wherever your GUI is
local statusLabel = screenGui:WaitForChild("StatusLabel")
local keyInput = screenGui:WaitForChild("KeyInput")

local function showError(message: string)
    statusLabel.Text = message
    statusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
end

local function showSuccess(message: string)
    statusLabel.Text = message
    statusLabel.TextColor3 = Color3.fromRGB(80, 255, 80)
end

local function showLoading()
    statusLabel.Text = "Validating key..."
    statusLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
end

local function showBanned()
    -- Kick with a clear message
    local player = Players.LocalPlayer
    player:Kick("Key dinonaktifkan / Key disabled. Hubungi admin.")
end

local function validateKey(key: string)
    showLoading()

    if not key:match("^LUXY%-[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]%-[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]%-[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]$") then
        showError("Format salah! Harus: LUXY-XXXX-XXXX-XXXX")
        return
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
        showError("Tidak bisa konek ke server / Cannot connect. Coba lagi.")
        return
    end

    local status = response.StatusCode
    local data = HttpService:JSONDecode(response.Body)

    if status == 200 then
        showSuccess("Key valid! Loading script...")
        task.wait(1)
        -- Proceed to load main script
        -- loadstring(game:HttpGet("..."))()
    elseif status == 404 then
        showError("Key salah. Cek lagi key kamu.")
    elseif status == 403 then
        if data.message == "Key expired" then
            showError("Key sudah expired. Cek lagi key kamu.")
        else
            showBanned()
        end
    elseif status == 429 then
        showError("Terlalu banyak percobaan. Tunggu sebentar ya.")
    else
        showError("Error tidak diketahui (code: " .. tostring(status) .. ")")
    end
end

-- Hook to UI button or remote event
keyInput.FocusLost:Connect(function(enterPressed)
    if enterPressed then
        validateKey(keyInput.Text)
    end
end)
```

### d) cURL

```bash
# Health check
curl -s https://luxyhub.vercel.app/api/health

# Validate key
curl -s -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'

# Validate with verbose (see status code & Retry-After header)
curl -v -X POST https://luxyhub.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"LUXY-ABCD-EFGH-IJKL"}'
```

### e) Python

```python
import re
import time
import requests

BASE_URL = "https://luxyhub.space"
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
            return False, "Invalid key format or missing key"
        elif status == 404:
            return False, "Invalid key"
        elif status == 403:
            return False, "Key expired or disabled"
        elif status == 500:
            return False, "Server error"
        else:
            return False, f"Unexpected status {status}"

    return False, "Max retries exceeded"

# Usage
valid, error = validate_key("LUXY-ABCD-EFGH-IJKL")
if valid:
    print("Key valid")
else:
    print(f"Validation failed: {error}")
```

### f) Node.js / TypeScript

```typescript
const BASE_URL = 'https://luxyhub.space'
const KEY_REGEX = /^LUXY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

interface ValidationResult {
  valid: boolean
  error?: string
}

async function validateKey(key: string, maxRetries: number = 3): Promise<ValidationResult> {
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
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000))
          continue
        }
        return { valid: false, error: 'Rate limited' }
      }

      const body = await response.json()

      switch (response.status) {
        case 400:
          return { valid: false, error: 'Invalid format or missing key' }
        case 404:
          return { valid: false, error: 'Invalid key' }
        case 403:
          return { valid: false, error: body.message === 'Key expired' ? 'Key expired' : 'Key disabled' }
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

// Usage
const result = await validateKey('LUXY-ABCD-EFGH-IJKL')
if (result.valid) {
  console.log('Key valid')
} else {
  console.error('Validation failed:', result.error)
}
```

---

## Best Practices

### 1. Cache validation results

Do not call `/api/validate` every frame or every time a function runs. Cache the result for the session lifetime — validate once on script start.

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

### 2. Set HTTP timeouts

Always set a timeout (5 seconds recommended) so a downed server doesn't hang the script indefinitely.

```lua
-- syn.request does not natively support timeouts — wrap in coroutine or spawn
-- Python: requests.post(..., timeout=5)
-- Node.js: AbortController with setTimeout
```

### 3. Implement exponential backoff for retries

On 429 or network failures, wait `2^attempt` seconds before retrying (2s, 4s, 8s). Respect the `Retry-After` header when present.

### 4. Never hardcode API keys

Keys should come from:

- User input (TextBox in GUI)
- Configuration file (user-editable, not compiled in)
- Environment variable (server-side only)

Never ship a script with a baked-in key.

### 5. Graceful degradation

If the API is unreachable, default to **blocking** the script rather than letting it run. Never skip validation because the server is down — that's a common bypass vector.

### 6. Client-side format validation first

Check the regex before sending a request. This saves API calls and gives instant feedback for obviously malformed keys.

### 7. Log failures for debugging

On non-200 responses, log the status code and body to help with support tickets.

```lua
warn("[LuxyHub] Validation failed — status:", status, "body:", response.Body)
```

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
                   ┌───────────────────┐     ┌─────────────────────────────┐
                   │ Client-side regex │────▶│ Show: "Invalid key format"  │
                   │ check             │ NO  │ Stop.                       │
                   └────────┬──────────┘     └─────────────────────────────┘
                            │ YES
                            ▼
                   ┌───────────────────┐
                   │ POST /api/validate│
                   └────────┬──────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ HTTP 200   │ │ HTTP 429   │ │ Network    │
     │ success:true│ │ Rate limit │ │ error      │
     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
           │              │              │
           ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ Run script │ │ Retry with │ │ Retry with │
     │            │ │ Retry-After│ │ backoff    │
     └────────────┘ └─────┬──────┘ └─────┬──────┘
                          │              │
                          ▼              ▼
                   ┌───────────────────────────┐
                   │ Retries exhausted?        │
                   └─────────┬─────────────────┘
                             │
                   ┌─────────┴─────────┐
                   ▼                   ▼
            ┌────────────┐     ┌────────────┐
            │ YES: Show  │     │ NO: Retry  │
            │ error, stop│     │ loop back  │
            └────────────┘     └────────────┘

              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
      ┌────────────┐ ┌────────────┐ ┌────────────┐
      │ HTTP 400   │ │ HTTP 404   │ │ HTTP 403   │
      │ Bad req    │ │ Not found  │ │ Forbidden  │
     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
           │              │              │
           ▼              ▼              ▼
      ┌────────────┐ ┌────────────┐ ┌────────────┐
      │ Show format│ │ Show: key  │ │ Show: key  │
      │ error. Stop│ │ invalid.   │ │ expired or │
      │            │ │ Stop.      │ │ disabled   │
      └────────────┘ └────────────┘ └────────────┘

              ┌─────────────┐
              ▼             ▼
     ┌────────────┐ ┌────────────┐
     │ HTTP 500   │ │ Unknown    │
     │ Server err │ │ status     │
     └─────┬──────┘ └─────┬──────┘
           │              │
           ▼              ▼
     ┌────────────┐ ┌────────────┐
     │ Show: try  │ │ Log & show │
     │ again later│ │ generic    │
     │ Stop.      │ │ error. Stop│
     └────────────┘ └────────────┘
```
