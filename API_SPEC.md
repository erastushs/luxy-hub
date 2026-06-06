# LuxyHub API Specification v1

## Overview

Base URL

```text
https://api.luxyhub.space
```

Content-Type

```text
application/json
```

---

# Response Standard

Semua endpoint wajib menggunakan format berikut.

## Success Response

```json
{
  "success": true,
  "data": {}
}
```

## Error Response

```json
{
  "success": false,
  "message": "Error message"
}
```

---

# Health Check

## Request

```http
GET /api/health
```

## Success Response

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

---

# Generate Key

## Request

```http
POST /api/generate
```

Body

```json
{
  "checkpoint_token": "example-token"
}
```

## Success Response

```json
{
  "success": true,
  "data": {
    "key": "LUXY-ABCD-EFGH-IJKL",
    "expires_at": "2026-06-07T00:00:00Z"
  }
}
```

## Error Responses

### Invalid Checkpoint

```json
{
  "success": false,
  "message": "Checkpoint verification failed"
}
```

### Rate Limited

```json
{
  "success": false,
  "message": "Rate limit exceeded"
}
```

---

# Validate Key

## Request

```http
POST /api/validate
```

Body

```json
{
  "key": "LUXY-ABCD-EFGH-IJKL"
}
```

## Success Response

```json
{
  "success": true,
  "data": {
    "valid": true,
    "expires_at": "2026-06-07T00:00:00Z",
    "key_type": "free"
  }
}
```

## Invalid Key

```json
{
  "success": false,
  "message": "Invalid key"
}
```

## Expired Key

```json
{
  "success": false,
  "message": "Key expired"
}
```

## Disabled Key

```json
{
  "success": false,
  "message": "Key disabled"
}
```

---

# Key Types

Possible values

```text
free
premium
admin
```

---

# Error Codes

| Code           | Description       |
| -------------- | ----------------- |
| INVALID_KEY    | Key not found     |
| EXPIRED_KEY    | Key expired       |
| DISABLED_KEY   | Key disabled      |
| RATE_LIMIT     | Too many requests |
| INTERNAL_ERROR | Server error      |

Example

```json
{
  "success": false,
  "code": "INVALID_KEY",
  "message": "Invalid key"
}
```

---

# Validation Rules

A key is valid only when:

- Key exists
- is_active = true
- Current time < expires_at

Otherwise validation fails.

---

# Example Script Flow

1. User mendapatkan key dari website.
2. User memasukkan key ke GUI script.
3. Script mengirim request ke `/api/validate`.
4. API mengembalikan status valid atau tidak.
5. Jika valid, script dijalankan.
6. Jika tidak valid, script dihentikan.

---

# Versioning

Current Version

```text
v1
```

Rules

- Jangan mengubah format response tanpa membuat versi baru.
- Jika ada perubahan besar gunakan:

```text
/api/v2/validate
```

bukan mengganti endpoint lama.
