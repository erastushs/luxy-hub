# OH-01 Migration Validation Report

Run ID: `oh_m3_20260612125951_8c5c58fa`
Date: 2026-06-12T12:59:56.120Z
Environment: development only (djbpwtjocjeaesmwjlpu.supabase.co)

## Static Migration Replay Readiness

| Migration | Status | Notes |
| --- | --- | --- |
| 001_enable_rls.sql | PASS | transaction and expected DDL markers present |
| 002_cdn_tables.sql | PASS | transaction and expected DDL markers present |
| 003_profiles.sql | PASS | transaction and expected DDL markers present |
| 004_script_ownership.sql | PASS | transaction and expected DDL markers present |
| 005_audit_logs.sql | PASS | transaction and expected DDL markers present |
| 006_delivery_builds.sql | PASS | transaction and expected DDL markers present |
| 007_delivery_sessions.sql | PASS | transaction and expected DDL markers present |
| 008_event_platform.sql | PASS | transaction and expected DDL markers present |
| 009_event_platform_hardening.sql | PASS | transaction and expected DDL markers present |
| 010_internal_alerts.sql | PASS | transaction and expected DDL markers present |
| 011_alert_events_rls.sql | PASS | transaction and expected DDL markers present |
| 012_script_executions.sql | PASS | transaction and expected DDL markers present |
| 013_license_schema_foundation.sql | PASS | transaction and expected DDL markers present |
| 014_runtime_license_enforcement.sql | PASS | transaction and expected DDL markers present |

## Live Development Schema Smoke Checks

| Object | Status | Detail |
| --- | --- | --- |
| scripts | PASS | select head succeeded |
| script_versions | PASS | select head succeeded |
| profiles | PASS | select head succeeded |
| audit_logs | PASS | select head succeeded |
| delivery_builds | PASS | select head succeeded |
| delivery_sessions | PASS | select head succeeded |
| webhook_config | PASS | select head succeeded |
| event_logs | PASS | select head succeeded |
| alert_events | PASS | select head succeeded |
| script_executions | PASS | select head succeeded |
| licenses | PASS | select head succeeded |
| license_assignments | PASS | select head succeeded |
| RPC authorize_license_assignment | PASS | [{"success":false,"created":false,"id":null,"license_id":"b8f37997-7772-4ff1-9bb9-0661ebcd1d7c","customer_identifier_hash":"ea5fe67e69d92087a181573e79c7d470ab52a0a419a945d94f4a2129d868b53e","display_name":null,"status":null,"created_at":null,"updated_at":null}] |
| RPC increment_license_delivery_count | PASS | void ok |

Catalog-level verification of indexes, constraints, triggers, grants, revokes, and policy definitions requires direct SQL access (`psql`, Supabase SQL editor, or Management API). This environment only has PostgREST/auth keys, so those objects were validated through migration text and live behavior smoke checks.
