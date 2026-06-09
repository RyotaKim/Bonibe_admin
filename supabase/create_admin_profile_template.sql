-- Bonibe official admin profile template
-- 1. Create the Auth user in Supabase Dashboard > Authentication > Users.
-- 2. Copy the new user's UUID.
-- 3. Replace paste-auth-user-id-here and run this SQL.

insert into profiles (
  id,
  company_id,
  staff_name,
  employee_code,
  email,
  role,
  assigned_location_id,
  active
) values (
  'paste-auth-user-id-here',
  'bonibe',
  'Bonibe Admin',
  'ADMIN-001',
  'replace-with-admin-email@example.com',
  'admin',
  null,
  true
)
on conflict (id) do update set
  company_id = excluded.company_id,
  staff_name = excluded.staff_name,
  employee_code = excluded.employee_code,
  email = excluded.email,
  role = excluded.role,
  assigned_location_id = excluded.assigned_location_id,
  active = excluded.active,
  updated_at = now();
