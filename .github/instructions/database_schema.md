# Database Schema Guidance

Use the Flutter repository's `supabase/schema.sql` as the current schema anchor unless migrations are introduced. The admin app must stay compatible with that schema.

## Core Tables

- `companies`
- `profiles`
- `locations`
- `products`
- `composite_items`
- `bundle_components`
- `production_reports`
- `production_report_lines`
- `inventory_ledger_entries`
- `sales_entries`
- `sales_lines`
- `expenses`
- `damages_returns`
- `client_ledger_entries`
- `branch_ledger_entries`
- `reconciliations`
- `generated_documents`
- `report_exports`
- `audit_logs`
- `sync_queue`

## Admin Expectations

- Staff provisioning creates Supabase Auth users and matching `profiles` rows.
- Branch profiles require `assigned_location_id`.
- Product edits must preserve references from sales, production, bundle, and ledger records.
- Bundle setup uses `composite_items` and `bundle_components`.
- Report files belong in the `report-exports` storage bucket with metadata in `report_exports`.
- Sync review reads `sync_queue.status`, `attempts`, `last_error`, and `payload`.
- Admin correction workflows should create auditable records instead of changing finalized operational history in place.

## ID Rules

- Operational records use client-generated text IDs.
- Do not convert schema contracts to database-generated UUIDs where the Flutter app creates records offline.
- Keep idempotency keys unique and visible for retryable writes.
