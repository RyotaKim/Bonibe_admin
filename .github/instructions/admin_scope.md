# Admin Scope

Bonibe Admin is allowed to contain admin screens because it is a separate React repository. The Flutter Bonibe operations app must remain focused on offline-first Kitchen and Branch operations.

## Build Here

- Staff provisioning and profile management.
- Role assignment for `kitchen`, `branch`, and `admin`.
- Branch assignment through `profiles.assigned_location_id`.
- Product catalog and pricing.
- Composite bundle setup.
- Location and company settings.
- Sync queue review and retry/needs-review workflows.
- Audit logs and operational record inspection.
- Report export search, download, and metadata management.

## Keep Out

- Public marketing pages.
- Self-service staff signup.
- Daily production entry.
- Branch POS sales entry.
- Damage/return entry as a daily branch workflow.
- Cash reconciliation as a daily branch workflow.
- Offline local database behavior for field operations.

The admin site can review these operational records, but the source workflow stays in the Flutter app.
