# Handoff Steps For Future Codex Sessions

Use this checklist when continuing or recreating the Bonibe Admin website.

1. Confirm this is the separate React admin repository, not the Flutter operations app.
2. Read `.github/copilot-instructions.md`.
3. Read the relevant topic files in `.github/instructions`.
4. Use `npm install` if dependencies are missing.
5. Copy `.env.example` to `.env.local` and fill Supabase anon configuration for live work.
6. Keep Supabase service-role keys out of browser code and git history.
7. Build admin workflows around the inherited Supabase schema.
8. Keep daily offline-first Kitchen and Branch workflows in the Flutter app.
9. Add feature folders as pages become real: staff, catalog, locations, sync, reports, settings.
10. Verify with `npm run build` and `npm run lint` before handoff.

## First Implementation Targets

- Supabase auth shell with admin role check.
- Staff/profile list connected to `profiles`.
- Product catalog connected to `products`, `composite_items`, and `bundle_components`.
- Location management connected to `locations` and `companies`.
- Sync queue review connected to `sync_queue`.
- Report exports connected to `report_exports` and storage bucket links.
