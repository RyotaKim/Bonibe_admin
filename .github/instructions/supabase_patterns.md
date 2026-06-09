# Supabase Patterns

## Configuration

- Read Supabase config from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Keep `.env.local` ignored.
- Never commit service-role keys or private credentials.
- The browser app should use anon-key Supabase access only.

## Auth And Access

- Admin users authenticate through Supabase Auth.
- Use the authenticated user's `profiles` row to confirm `role = 'admin'`.
- RLS must protect admin-only data access.
- Privileged operations should use RLS-safe policies, SQL functions, or a server-side API.
- Do not rely on client-side route guards as the only security boundary.

## Query Shape

Prefer focused queries or database views for:

- Staff/profile lists.
- Product catalog and bundle components.
- Location management.
- Sync queue status and failure review.
- Report export metadata.
- Audit trail lookup.
- Operational summaries by location/date.

Keep expensive calculations in SQL views/functions or shared domain utilities where practical. Do not hide important business calculations inside visual components.

## Mutations

- Product, location, and profile updates should write audit logs where practical.
- Finalized operational records should not be destructively edited.
- Retry and correction actions must remain idempotent.
