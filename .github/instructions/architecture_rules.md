# Architecture Rules

## Product Goal

Bonibe Admin is a compact web console for owners/admins to manage users, master data, reports, and sync/audit review for Bonibe Bakeshop Suite.

## Rules

- Keep Supabase access in focused data modules under `src/lib` or `src/features/*/data`.
- Keep components presentational where possible; put business mapping, validation, and query shaping outside JSX-heavy files.
- Use React Router for page-level navigation.
- Prefer feature folders as the app grows: `src/features/staff`, `src/features/catalog`, `src/features/reports`, and similar.
- Use append-only correction/audit records for operational fixes.
- Do not perform destructive edits on finalized operational records.
- Keep IDs compatible with the Flutter app: text IDs for operational records and stable IDs for master data.
- Treat snapshot/current-stock data as read models, not the inventory source of truth.
- Run `npm run build` before considering structural changes complete.

## Separation From Flutter

The Flutter app handles offline-first writes and daily branch/kitchen usage. This React app handles admin oversight and configuration. Do not duplicate local queue logic or move daily operational screens into this repository.
