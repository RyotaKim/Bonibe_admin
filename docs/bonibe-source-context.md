# Bonibe Source Context

This admin repo was created from the Bonibe Flutter operations app context.

## Original App

- Repository: `Bonibe`
- App: Bonibe Bakeshop DMS
- Platform: Flutter offline-ready Progressive Web App and mobile/tablet app
- Backend: Supabase Auth, PostgreSQL, RLS, and Storage

## Supabase Setup Summary

The original app uses:

- `supabase/schema.sql` as the schema anchor.
- `supabase/seed.sql` for Bonibe master data.
- Auth users created manually in Supabase Authentication.
- Matching `profiles` rows for staff role and location assignment.
- `report-exports` storage bucket for generated report files.

Suggested starter users from the source docs:

- `kitchen@bonibe.test`
- `branch1@bonibe.test`
- `branch2@bonibe.test`

For branch users, use role `branch` and assigned locations like `branch_1` or `branch_2`.

## Important Difference

The Flutter app intentionally excludes admin UI. This repository exists specifically to provide that admin UI in a separate React website.

## Shared Rules

- Inventory remains event/ledger-derived.
- Operational writes are idempotent and retryable.
- Finalized operational records should be corrected through auditable events.
- Supabase credentials must come from environment variables.
- Never commit private keys or production secrets.
