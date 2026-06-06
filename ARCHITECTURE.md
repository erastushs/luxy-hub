# LuxyHub Key System Architecture

## Overview

LuxyHub Key System is responsible for:

- Generating user access keys
- Validating keys for Roblox scripts
- Monetizing free users through LootLabs
- Tracking usage statistics
- Supporting future Premium Keys

---

# High Level Architecture

```text
User
 │
 ▼
LuxyHub Website
 │
 ▼
LootLabs Checkpoint
 │
 ▼
Generate Key API
 │
 ▼
Supabase Database
 │
 ▼
Key Returned To User
 │
 ▼
Roblox Script
 │
 ▼
Validate API
 │
 ▼
Supabase Database
 │
 ▼
Success / Failure
```

---

# Components

## Frontend

Responsibilities:

- Display Get Key page
- Display generated key
- Copy key functionality
- Show expiration information
- Handle LootLabs flow

Pages:

```text
/
/get-key
/how-to-use
/privacy
/terms
```

Recommended Stack:

- Next.js
- TailwindCSS
- Vercel

---

## Backend API

Responsibilities:

- Generate keys
- Validate keys
- Manage expiration
- Log usage
- Apply rate limits

Recommended Stack:

- Next.js API Routes
- Vercel Functions

---

## Database

Provider:

- Supabase

---

# Database Design

## keys

Stores all generated keys.

| Column     | Type      |
| ---------- | --------- |
| id         | uuid      |
| key        | text      |
| created_at | timestamp |
| expires_at | timestamp |
| is_active  | boolean   |

Example:

```json
{
  "key": "LUXY-ABCD-EFGH-IJKL",
  "expires_at": "2026-06-07T00:00:00Z",
  "is_active": true
}
```

---

## key_usage

Stores validation history.

| Column  | Type      |
| ------- | --------- |
| id      | uuid      |
| key     | text      |
| used_at | timestamp |

Purpose:

- Usage analytics
- Abuse detection
- Statistics

---

## Optional Future Table

### users

| Column          | Type      |
| --------------- | --------- |
| id              | uuid      |
| ip_address      | text      |
| last_generate   | timestamp |
| generated_today | integer   |

Purpose:

- Prevent abuse
- Rate limiting

---

# API Design

---

## Health Check

### GET /api/health

Response:

```json
{
  "status": "ok"
}
```

Purpose:

- Monitoring
- Uptime checks

---

## Generate Key

### POST /api/generate

Request:

```json
{
  "checkpointCompleted": true
}
```

Response:

```json
{
  "success": true,
  "key": "LUXY-ABCD-EFGH-IJKL",
  "expires_at": "2026-06-07T00:00:00Z"
}
```

Validation:

- LootLabs completion required
- Rate limit check
- Generate unique key

---

## Validate Key

### POST /api/validate

Request:

```json
{
  "key": "LUXY-ABCD-EFGH-IJKL"
}
```

Response:

```json
{
  "success": true,
  "expires_at": "2026-06-07T00:00:00Z"
}
```

Failure Response:

```json
{
  "success": false,
  "message": "Invalid key"
}
```

Validation Rules:

1. Key exists
2. Key is active
3. Key is not expired

---

# Key Lifecycle

```text
Generate Key
     │
     ▼
Store In Database
     │
     ▼
User Copies Key
     │
     ▼
Script Sends Key
     │
     ▼
Validate API
     │
     ▼
Access Granted
```

---

# Monetization Flow

```text
User
 │
 ▼
Get Key Page
 │
 ▼
LootLabs
 │
 ▼
Checkpoint Completed
 │
 ▼
Generate Key API
 │
 ▼
Display Key
```

Rules:

- No checkpoint = No key
- One user cannot generate unlimited keys
- Keys expire after 24 hours

---

# Security Design

## Rate Limits

Generate API

```text
3 requests per day
```

Validate API

```text
30 requests per minute
```

---

## Cloudflare Protection

Enable:

- Bot Protection
- WAF Rules
- DDoS Protection
- Rate Limiting

---

## Input Validation

Validate:

- Missing key
- Invalid key format
- Oversized payloads
- Unexpected fields

---

# Recommended Key Format

```text
LUXY-ABCD-EFGH-IJKL
```

Advantages:

- Easy to read
- Easy to copy
- Professional appearance

---

# Future Expansion

## Premium Keys

Types:

```text
free
premium
admin
```

Premium Benefits:

- Longer expiration
- No checkpoint
- Faster updates
- Premium features

---

# Deployment

Frontend

```text
Vercel
```

Backend

```text
Vercel Functions
```

Database

```text
Supabase
```

Protection

```text
Cloudflare
```

Domain

```text
luxyhub.space
```

---

# Production Readiness Checklist

- Database operational
- API tested
- LootLabs integrated
- SSL enabled
- Backups configured
- Monitoring enabled
- Rate limits configured
- Error logging configured

When all items are complete, the LuxyHub Key System is ready for production deployment.
