# Bonibe Admin

React admin website for Bonibe Bakeshop Suite.

This repository is separate from the Flutter operations app. The Flutter app remains the offline-first Kitchen and Branch tool; this admin site is for owner/admin review, staff provisioning, master data, sync review, reports, and system settings over the same Supabase backend.

## Stack

- React + TypeScript + Vite
- React Router
- Supabase JavaScript client
- Lucide React icons

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set live Supabase values in `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Do not commit `.env.local`, service-role keys, database passwords, or private Supabase credentials.

## Supabase admin access

The app uses Supabase Auth and requires the signed-in user's `profiles.role` to be `admin`.

After applying the base Bonibe schema, run this file in the Supabase SQL Editor if admin writes are blocked by RLS:

```text
supabase/admin_access_policies.sql
```

This enables admin-profile users to manage profiles, companies, locations, products, bundles, and audit visibility through normal authenticated RLS. Supabase Auth user creation still needs the Supabase dashboard or a server-side admin API because service-role keys must never run in browser code.

## Admin scope

Build admin-only workflows here:

- Staff account provisioning and profile role/location management.
- Product, price, threshold, and composite bundle master data.
- Company, Kitchen, Branch, and Client location records.
- Sync queue review, failed write triage, and audit log inspection.
- Generated report lookup and export/download workflows.
- Company branding and report header settings.

Daily production, POS sales, damage/return entry, reconciliation, and offline queueing stay in the Flutter operations app.

## Supabase contract

This admin app should align with the existing `Bonibe/supabase/schema.sql` schema anchor:

- `profiles`
- `locations`
- `products`
- `composite_items`
- `bundle_components`
- `sync_queue`
- `audit_logs`
- `report_exports`
- `generated_documents`
- operational ledger/report tables for read-only review

Privileged admin writes should use RLS-safe policies or server-side functions. The browser app must never use a service-role key.

## Development notes

Before major changes, read `.github/copilot-instructions.md` and the topic files in `.github/instructions`.

Useful commands:

```powershell
npm run dev
npm run build
npm run lint
```
