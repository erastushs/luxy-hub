# Phase 7 — Account Password Management

Status: Implemented
Last updated: 2026-06-09

## Purpose

Authenticated creators can change their own dashboard password from `/dashboard/profile`. Password ownership, hashing, storage, recovery tokens, and credential policy enforcement remain delegated to Supabase Auth.

## Flow

```text
Creator opens /dashboard/profile
  |
  v
Dashboard layout/session auth verifies Supabase session
  |
  v
ProfileClient renders Security form
  |
  v
Submit Save Password
  |
  v
app/actions/security.ts changePasswordAction()
  |-- validates current Supabase Auth user from cookies
  |-- validates submitted password fields
  |-- supabase.auth.updateUser({ password })
  |-- revalidatePath('/dashboard/profile')
  `-- returns success/error state to the client form
  |
  v
Client shows success toast or error banner
```

No `creator_id`, profile, script, delivery, build, or ownership state participates in this flow.

## UI

`/dashboard/profile` now includes a **Security** card with:

- New Password (`type="password"`)
- Confirm New Password (`type="password"`)
- Save Password button
- Pending state while the Server Action is running
- Error banner for validation or Supabase Auth failures
- Success toast after Supabase Auth accepts the password update

The current-password field is not rendered. Supabase's authenticated `updateUser()` API updates the password for the current session user and does not require the old password in this dashboard flow.

## Validation Rules

Server-side validation in `changePasswordAction()` rejects:

- Empty new password
- New password shorter than 8 characters
- Empty confirmation
- Confirmation that does not match the new password

Client-side form attributes mirror the minimum length and required-field constraints, but the Server Action is authoritative.

## Supabase Integration Notes

- Password update uses `supabase.auth.updateUser({ password })` from the request-scoped Supabase SSR client.
- The authenticated user is resolved with `supabase.auth.getUser()`, which reads the current Supabase session from cookies without touching the profile service.
- The action never accepts a user ID from client input.
- The action never writes to `profiles` or any application table.
- The action never logs, stores, hashes, or copies password values outside the Supabase Auth request.

## Security Considerations

- Only the current authenticated session can change its account password.
- No ownership helpers were modified.
- Profile auto-provisioning remains unchanged.
- Delivery APIs and build pipeline are untouched.
- No password history table, custom hashing, or password mirror exists.
- Returned action state contains only friendly status messages, not password data.

## Email Recovery Audit

Supabase Auth supports password recovery through its built-in reset-password email flow. A public "Forgot Password" link on `/login` would be useful once the project wants self-service recovery UX, but it requires configuring Supabase email templates/redirect URLs and a reset confirmation page. That flow was not implemented here because this phase only adds authenticated password changes from the dashboard.
