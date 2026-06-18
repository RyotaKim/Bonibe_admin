-- Profile-only account creation for the Bonibe Admin site.
-- Run this in Supabase SQL Editor after the base schema and admin policies.
--
-- This keeps admin login protected by Supabase Auth, but lets an authenticated
-- admin create staff/profile rows without creating new Supabase Auth users or
-- sending verification/password emails.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
add column if not exists password_hash text;

alter table public.profiles
drop constraint if exists branch_profiles_need_location;

alter table public.profiles
drop constraint if exists location_profiles_need_location;

alter table public.profiles
add constraint location_profiles_need_location check (
  role not in ('branch', 'kitchen') or assigned_location_id is not null
);

drop policy if exists "admin can manage locations" on locations;
create policy "admin can manage locations"
on locations for all
to authenticated
using (current_profile_role() = 'admin')
with check (current_profile_role() = 'admin');

drop policy if exists "admin can manage profiles" on profiles;
create policy "admin can manage profiles"
on profiles for all
to authenticated
using (current_profile_role() = 'admin')
with check (current_profile_role() = 'admin');

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_class foreign_rel on foreign_rel.oid = con.confrelid
    join pg_namespace foreign_nsp on foreign_nsp.oid = foreign_rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'f'
      and foreign_nsp.nspname = 'auth'
      and foreign_rel.relname = 'users'
  loop
    execute format(
      'alter table public.profiles drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end $$;

create or replace function public.slug_part(value text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '_' from regexp_replace(lower(value), '[^a-z0-9]+', '_', 'g')),
      ''
    ),
    'location'
  )
$$;

drop function if exists public.create_staff_profile_with_location(
  text,
  text,
  text,
  text,
  text
);

drop function if exists public.create_staff_profile_with_location(
  text,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.create_staff_profile_with_location(
  p_staff_name text,
  p_email text,
  p_employee_code text,
  p_password text,
  p_role text,
  p_company_id text default 'bonibe'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid := gen_random_uuid();
  v_location_id text;
  v_role text := trim(lower(coalesce(p_role, 'branch')));
  v_staff_name text := trim(coalesce(p_staff_name, ''));
  v_email text := trim(coalesce(p_email, ''));
  v_employee_code text := nullif(trim(coalesce(p_employee_code, '')), '');
  v_password text := trim(coalesce(p_password, ''));
  v_company_id text := trim(coalesce(p_company_id, 'bonibe'));
  v_location_code text;
  v_now timestamptz := now();
begin
  if current_profile_role() <> 'admin' then
    raise exception 'Only admin accounts can create staff profiles.'
      using errcode = '42501';
  end if;

  if v_staff_name = '' then
    raise exception 'Account name is required.';
  end if;

  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  if length(v_password) < 4 then
    raise exception 'Password must be at least 4 characters.';
  end if;

  if v_role not in ('admin', 'branch', 'kitchen') then
    raise exception 'Role must be admin, branch, or kitchen.';
  end if;

  if v_role in ('branch', 'kitchen') then
    v_location_id :=
      v_role || '_' ||
      left(public.slug_part(v_staff_name), 40) || '_' ||
      left(replace(v_profile_id::text, '-', ''), 8);
    v_location_code :=
      coalesce(
        v_employee_code,
        left(
          case when v_role = 'branch' then 'BR-' else 'KIT-' end ||
          upper(replace(public.slug_part(v_staff_name), '_', '-')),
          32
        )
      );

    if exists (
      select 1
      from public.locations
      where company_id = v_company_id
        and lower(code) = lower(v_location_code)
    ) then
      v_location_code :=
        left(v_location_code, 23) || '-' ||
        left(replace(v_profile_id::text, '-', ''), 8);
    end if;

    insert into public.locations (
      id,
      company_id,
      name,
      code,
      type,
      address,
      contact_person,
      active,
      updated_at
    ) values (
      v_location_id,
      v_company_id,
      v_staff_name,
      v_location_code,
      v_role::public.location_type,
      null,
      null,
      true,
      v_now
    );
  end if;

  insert into public.profiles (
    id,
    company_id,
    staff_name,
    employee_code,
    email,
    password_hash,
    role,
    assigned_location_id,
    active,
    updated_at
  ) values (
    v_profile_id,
    v_company_id,
    v_staff_name,
    v_employee_code,
    v_email,
    crypt(v_password, gen_salt('bf')),
    v_role::public.app_role,
    v_location_id,
    true,
    v_now
  );

  return jsonb_build_object(
    'userId', v_profile_id,
    'email', v_email,
    'role', v_role,
    'assignedLocationId', v_location_id
  );
end
$$;

grant execute on function public.create_staff_profile_with_location(
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

create or replace function public.verify_staff_profile_password(
  p_identifier text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_identifier text := trim(lower(coalesce(p_identifier, '')));
  v_password text := trim(coalesce(p_password, ''));
  v_profile record;
begin
  if v_identifier = '' or v_password = '' then
    return null;
  end if;

  select
    profiles.id,
    profiles.staff_name,
    profiles.employee_code,
    profiles.email,
    profiles.role,
    profiles.assigned_location_id,
    locations.name as location_name
  into v_profile
  from public.profiles
  left join public.locations
    on locations.id = profiles.assigned_location_id
  where profiles.active = true
    and profiles.password_hash is not null
    and profiles.password_hash = crypt(v_password, profiles.password_hash)
    and (
      lower(coalesce(profiles.email, '')) = v_identifier
      or lower(coalesce(profiles.employee_code, '')) = v_identifier
    )
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_profile.id,
    'staff_name', v_profile.staff_name,
    'employee_code', v_profile.employee_code,
    'email', v_profile.email,
    'role', v_profile.role,
    'assigned_location_id', v_profile.assigned_location_id,
    'location_name', v_profile.location_name
  );
end
$$;

revoke all on function public.verify_staff_profile_password(text, text) from public;
grant execute on function public.verify_staff_profile_password(text, text) to anon, authenticated;

create or replace function public.update_staff_profile_password(
  p_profile_id uuid,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_password text := trim(coalesce(p_password, ''));
  v_profile record;
begin
  if current_profile_role() <> 'admin' then
    raise exception 'Only admin accounts can update staff passwords.'
      using errcode = '42501';
  end if;

  if length(v_password) < 4 then
    raise exception 'Password must be at least 4 characters.';
  end if;

  select id, role
  into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    raise exception 'Account profile was not found.';
  end if;

  update public.profiles
  set
    password_hash = crypt(v_password, gen_salt('bf')),
    updated_at = now()
  where id = p_profile_id;

  if v_profile.role = 'admin' then
    update auth.users
    set
      encrypted_password = crypt(v_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = '',
      recovery_token = '',
      updated_at = now()
    where id = p_profile_id;
  end if;

  return jsonb_build_object(
    'userId', p_profile_id,
    'role', v_profile.role,
    'passwordUpdated', true
  );
end
$$;

revoke all on function public.update_staff_profile_password(uuid, text) from public;
grant execute on function public.update_staff_profile_password(uuid, text) to authenticated;
