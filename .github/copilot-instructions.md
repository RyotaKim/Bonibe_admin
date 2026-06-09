# Bonibe Admin Repository Instructions

These instructions are mandatory for code generation, review, refactoring, schema work, and UI changes in this repository.

Bonibe Admin is the React web admin console for Bonibe Bakeshop Suite. It is separate from the Flutter operations app. Build admin workflows for staff provisioning, master data, sync review, reports, audit visibility, company settings, and owner oversight over the shared Supabase backend.

## Fixed Stack

- Admin website: React + TypeScript + Vite.
- Routing: React Router.
- Backend: Supabase Auth + PostgreSQL + RLS + Storage.
- UI: compact operational admin interface using Bonibe green/yellow branding on light readable surfaces.
- Icons: use `lucide-react` where an icon is needed.
- Runtime configuration: read Supabase values from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Scope

Build admin-only tooling in this repository:

- Staff account/profile management.
- Role and branch assignment review.
- Product, price, category, threshold, and bundle management.
- Company and location setup.
- Sync queue review and failed write triage.
- Audit log and operational record inspection.
- Report export lookup and download.
- Company branding and report header fields.

Do not move daily Kitchen/Branch operational workflows into this admin app. Production entry, POS sales, damages/returns entry, expenses, reconciliation, local-first writes, and offline queueing remain in the Flutter operations app.

## Non-Negotiables

- Never commit Supabase service-role keys, database passwords, or private credentials.
- Browser code may use only anon-key Supabase access plus RLS-safe RPC/functions.
- Keep privileged admin mutations behind database RLS, SQL functions, or a server/API layer.
- Treat inventory as event/ledger-derived. Admin correction tools should create correction/audit events, not destructive edits.
- Keep admin tables dense, scannable, and responsive.
- Preserve role boundaries. Admin visibility does not mean bypassing auditability.
- Reports must use Bonibe headers and print-safe layouts.

## Instruction Files

Use the topic files in `.github/instructions` before making changes:

- `admin_scope.md`: admin responsibilities and boundaries.
- `architecture_rules.md`: app architecture and separation from the Flutter operations app.
- `database_schema.md`: Supabase tables and relationships inherited from Bonibe.
- `supabase_patterns.md`: auth, RLS, secrets, RPC, and query conventions.
- `ui_standards.md`: Bonibe admin UI standards.
- `handoff_steps.md`: step-by-step guidance for future setup or rebuilds.

When instructions conflict, follow this priority:

1. Explicit user request in the current task.
2. These repository instructions.
3. Existing app patterns in `src/` and `supabase` docs copied from Bonibe.
4. General React/Vite defaults.

## Done Means

A change is not done until it preserves admin boundaries, Supabase safety, auditability, compact UI behavior, and focused verification through `npm run build` or more specific tests where practical.
