-- Bonibe Admin RLS policies
-- Run this in the Supabase SQL Editor after the base Bonibe schema is applied.
-- These policies allow authenticated profiles with role = 'admin' to manage
-- admin-owned master data from the React admin site using the anon key.
--
-- Do not expose service-role keys in this React app. Creating Supabase Auth
-- users still belongs in the Supabase dashboard or a server-side admin API.

drop policy if exists "admin can manage profiles" on profiles;
create policy "admin can manage profiles"
on profiles for all
to authenticated
using (current_profile_role() = 'admin')
with check (current_profile_role() = 'admin');

drop policy if exists "admin can manage companies" on companies;
create policy "admin can manage companies"
on companies for all
to authenticated
using (current_profile_role() = 'admin')
with check (current_profile_role() = 'admin');

drop policy if exists "admin can manage locations" on locations;
create policy "admin can manage locations"
on locations for all
to authenticated
using (current_profile_role() = 'admin')
with check (current_profile_role() = 'admin');

drop policy if exists "admin can manage products" on products;
create policy "admin can manage products"
on products for all
to authenticated
using (current_profile_role() = 'admin')
with check (current_profile_role() = 'admin');

drop policy if exists "admin can manage composite items" on composite_items;
create policy "admin can manage composite items"
on composite_items for all
to authenticated
using (current_profile_role() = 'admin')
with check (current_profile_role() = 'admin');

drop policy if exists "admin can manage bundle components" on bundle_components;
create policy "admin can manage bundle components"
on bundle_components for all
to authenticated
using (current_profile_role() = 'admin')
with check (current_profile_role() = 'admin');

drop policy if exists "admin can read audit logs" on audit_logs;
create policy "admin can read audit logs"
on audit_logs for select
to authenticated
using (current_profile_role() = 'admin');

drop policy if exists "admin can write audit logs" on audit_logs;
create policy "admin can write audit logs"
on audit_logs for insert
to authenticated
with check (current_profile_role() = 'admin');

drop policy if exists "admin can read production lines" on production_report_lines;
create policy "admin can read production lines"
on production_report_lines for select
to authenticated
using (current_profile_role() = 'admin');

drop policy if exists "admin can read sales lines" on sales_lines;
create policy "admin can read sales lines"
on sales_lines for select
to authenticated
using (current_profile_role() = 'admin');
