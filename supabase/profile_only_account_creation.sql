-- Auth-backed staff account provisioning for the Bonibe Admin site.
-- Run this in Supabase SQL Editor after the base schema and admin policies.
--
-- This keeps the production contract intact:
--   public.profiles.id = auth.users.id
-- and lets the admin site create, update, backfill, and delete staff accounts
-- without using a service-role key in the browser.

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

drop policy if exists "admin can manage locations" on public.locations;
create policy "admin can manage locations"
on public.locations for all
to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "admin can manage profiles" on public.profiles;
create policy "admin can manage profiles"
on public.profiles for all
to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "admin can manage companies" on public.companies;
create policy "admin can manage companies"
on public.companies for all
to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "admin can manage products" on public.products;
create policy "admin can manage products"
on public.products for all
to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

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

create or replace function public.ensure_staff_auth_user(
  p_profile_id uuid,
  p_email text,
  p_password_hash text,
  p_staff_name text,
  p_employee_code text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_password_hash text := nullif(trim(coalesce(p_password_hash, '')), '');
  v_existing_password text;
  v_now timestamptz := now();
  v_identity_data jsonb;
begin
  if v_email = '' then
    raise exception 'Email is required for a Supabase Auth user.';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required for a Supabase Auth user.';
  end if;

  select encrypted_password
  into v_existing_password
  from auth.users
  where id = p_profile_id;

  if v_password_hash is null then
    v_password_hash := v_existing_password;
  end if;

  if v_password_hash is null then
    raise exception 'A password hash is required to create the auth user.';
  end if;

  if exists (
    select 1
    from auth.users
    where lower(email) = v_email
      and id <> p_profile_id
  ) then
    raise exception 'Another Supabase Auth user already uses this email.';
  end if;

  v_identity_data := jsonb_build_object(
    'sub', p_profile_id::text,
    'email', v_email,
    'email_verified', true,
    'phone_verified', false,
    'staff_name', trim(coalesce(p_staff_name, '')),
    'employee_code', nullif(trim(coalesce(p_employee_code, '')), ''),
    'role', trim(lower(coalesce(p_role, 'branch')))
  );

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_confirm_status,
    reauthentication_token,
    is_sso_user,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_profile_id,
    'authenticated',
    'authenticated',
    v_email,
    v_password_hash,
    v_now,
    '',
    v_now,
    '',
    '',
    '',
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email')
    ),
    v_identity_data,
    v_now,
    v_now,
    '',
    '',
    '',
    0,
    '',
    false,
    false
  )
  on conflict (id) do update
  set
    instance_id = coalesce(auth.users.instance_id, excluded.instance_id),
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
    confirmation_token = coalesce(auth.users.confirmation_token, excluded.confirmation_token),
    confirmation_sent_at = coalesce(auth.users.confirmation_sent_at, excluded.confirmation_sent_at),
    recovery_token = coalesce(auth.users.recovery_token, excluded.recovery_token),
    email_change_token_new =
      coalesce(auth.users.email_change_token_new, excluded.email_change_token_new),
    email_change = coalesce(auth.users.email_change, excluded.email_change),
    raw_app_meta_data =
      coalesce(auth.users.raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email')
      ),
    raw_user_meta_data =
      coalesce(auth.users.raw_user_meta_data, '{}'::jsonb) ||
      v_identity_data,
    phone_change = coalesce(auth.users.phone_change, excluded.phone_change),
    phone_change_token = coalesce(auth.users.phone_change_token, excluded.phone_change_token),
    email_change_token_current =
      coalesce(auth.users.email_change_token_current, excluded.email_change_token_current),
    email_change_confirm_status =
      coalesce(auth.users.email_change_confirm_status, excluded.email_change_confirm_status),
    reauthentication_token =
      coalesce(auth.users.reauthentication_token, excluded.reauthentication_token),
    is_sso_user = coalesce(auth.users.is_sso_user, excluded.is_sso_user),
    is_anonymous = coalesce(auth.users.is_anonymous, excluded.is_anonymous),
    updated_at = v_now;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    p_profile_id,
    v_identity_data,
    'email',
    p_profile_id::text,
    v_now,
    v_now
  )
  on conflict (provider_id, provider) do update
  set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = v_now;
end
$$;

revoke all on function public.ensure_staff_auth_user(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.ensure_staff_auth_user(
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;

do $$
declare
  v_profile record;
begin
  for v_profile in
    select id, email, password_hash, staff_name, employee_code, role
    from public.profiles
    where email is not null
      and password_hash is not null
      and (
        not exists (
          select 1 from auth.users where auth.users.id = profiles.id
        )
        or exists (
          select 1
          from auth.users
          where auth.users.id = profiles.id
            and (
              auth.users.instance_id is null
              or auth.users.confirmation_sent_at is null
              or coalesce(auth.users.raw_user_meta_data ->> 'email', '') = ''
              or coalesce(auth.users.raw_user_meta_data ->> 'sub', '') = ''
            )
        )
        or not exists (
          select 1
          from auth.identities
          where auth.identities.user_id = profiles.id
            and auth.identities.provider = 'email'
        )
      )
  loop
    perform public.ensure_staff_auth_user(
      v_profile.id,
      v_profile.email,
      v_profile.password_hash,
      v_profile.staff_name,
      v_profile.employee_code,
      v_profile.role::text
    );
  end loop;

  if not exists (
    select 1
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
  ) then
    alter table public.profiles
      add constraint profiles_id_auth_users_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

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

drop function if exists public.create_staff_profile_with_location(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.create_staff_profile_with_location(
  p_auth_user_id uuid,
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
set search_path = public, auth, extensions
as $$
declare
  v_profile_id uuid := coalesce(p_auth_user_id, gen_random_uuid());
  v_location_id text;
  v_role text := trim(lower(coalesce(p_role, 'branch')));
  v_staff_name text := trim(coalesce(p_staff_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_employee_code text := nullif(trim(coalesce(p_employee_code, '')), '');
  v_password text := trim(coalesce(p_password, ''));
  v_password_hash text;
  v_company_id text := trim(coalesce(p_company_id, 'bonibe'));
  v_location_code text;
  v_now timestamptz := now();
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'Only admin accounts can create staff profiles.'
      using errcode = '42501';
  end if;

  if v_profile_id is null then
    raise exception 'A Supabase Auth user ID is required.';
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

  v_password_hash := crypt(v_password, gen_salt('bf'));

  perform public.ensure_staff_auth_user(
    v_profile_id,
    v_email,
    v_password_hash,
    v_staff_name,
    v_employee_code,
    v_role
  );

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
        and id <> v_location_id
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
    )
    on conflict (id) do update
    set
      company_id = excluded.company_id,
      name = excluded.name,
      code = excluded.code,
      type = excluded.type,
      active = true,
      updated_at = excluded.updated_at;
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
    v_password_hash,
    v_role::public.app_role,
    v_location_id,
    true,
    v_now
  )
  on conflict (id) do update
  set
    company_id = excluded.company_id,
    staff_name = excluded.staff_name,
    employee_code = excluded.employee_code,
    email = excluded.email,
    password_hash = excluded.password_hash,
    role = excluded.role,
    assigned_location_id = excluded.assigned_location_id,
    active = excluded.active,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'userId', v_profile_id,
    'email', v_email,
    'role', v_role,
    'assignedLocationId', v_location_id
  );
end
$$;

revoke all on function public.create_staff_profile_with_location(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.create_staff_profile_with_location(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

create or replace function public.save_staff_profile_account(
  p_profile_id uuid,
  p_company_id text,
  p_staff_name text,
  p_employee_code text,
  p_email text,
  p_role text,
  p_assigned_location_id text,
  p_active boolean,
  p_sync_location_name boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_role text := trim(lower(coalesce(p_role, 'branch')));
  v_staff_name text := trim(coalesce(p_staff_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_company_id text := trim(coalesce(p_company_id, 'bonibe'));
  v_employee_code text := nullif(trim(coalesce(p_employee_code, '')), '');
  v_assigned_location_id text := nullif(trim(coalesce(p_assigned_location_id, '')), '');
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'Only admin accounts can update staff profiles.'
      using errcode = '42501';
  end if;

  if v_staff_name = '' then
    raise exception 'Account name is required.';
  end if;

  if v_role not in ('admin', 'branch', 'kitchen') then
    raise exception 'Role must be admin, branch, or kitchen.';
  end if;

  if v_role in ('branch', 'kitchen') and v_assigned_location_id is null then
    raise exception 'A branch or kitchen account needs an assigned location.';
  end if;

  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    raise exception 'Account profile was not found.';
  end if;

  update public.profiles
  set
    company_id = v_company_id,
    staff_name = v_staff_name,
    employee_code = v_employee_code,
    email = v_email,
    role = v_role::public.app_role,
    assigned_location_id = case
      when v_role in ('branch', 'kitchen') then v_assigned_location_id
      else null
    end,
    active = coalesce(p_active, true),
    updated_at = now()
  where id = p_profile_id;

  if coalesce(p_sync_location_name, false)
     and v_role in ('branch', 'kitchen')
     and v_assigned_location_id is not null then
    update public.locations
    set
      name = v_staff_name,
      type = v_role::public.location_type,
      updated_at = now()
    where id = v_assigned_location_id;
  end if;

  perform public.ensure_staff_auth_user(
    p_profile_id,
    v_email,
    v_profile.password_hash,
    v_staff_name,
    v_employee_code,
    v_role
  );

  return jsonb_build_object(
    'userId', p_profile_id,
    'email', v_email,
    'role', v_role,
    'saved', true
  );
end
$$;

revoke all on function public.save_staff_profile_account(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
) from public;

grant execute on function public.save_staff_profile_account(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
) to authenticated;

create or replace function public.backfill_staff_auth_users()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_profile record;
  v_repaired_count integer := 0;
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'Only admin accounts can backfill staff auth users.'
      using errcode = '42501';
  end if;

  for v_profile in
    select id, email, password_hash, staff_name, employee_code, role
    from public.profiles
    where email is not null
      and password_hash is not null
      and (
        not exists (
          select 1 from auth.users where auth.users.id = profiles.id
        )
        or exists (
          select 1
          from auth.users
          where auth.users.id = profiles.id
            and (
              auth.users.instance_id is null
              or auth.users.confirmation_sent_at is null
              or coalesce(auth.users.raw_user_meta_data ->> 'email', '') = ''
              or coalesce(auth.users.raw_user_meta_data ->> 'sub', '') = ''
            )
        )
        or not exists (
          select 1
          from auth.identities
          where auth.identities.user_id = profiles.id
            and auth.identities.provider = 'email'
        )
      )
  loop
    perform public.ensure_staff_auth_user(
      v_profile.id,
      v_profile.email,
      v_profile.password_hash,
      v_profile.staff_name,
      v_profile.employee_code,
      v_profile.role::text
    );
    v_repaired_count := v_repaired_count + 1;
  end loop;

  return jsonb_build_object('repairedUsers', v_repaired_count);
end
$$;

revoke all on function public.backfill_staff_auth_users() from public;
grant execute on function public.backfill_staff_auth_users() to authenticated;

create or replace function public.update_staff_profile_password(
  p_profile_id uuid,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_password text := trim(coalesce(p_password, ''));
  v_password_hash text;
  v_profile record;
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'Only admin accounts can update staff passwords.'
      using errcode = '42501';
  end if;

  if length(v_password) < 4 then
    raise exception 'Password must be at least 4 characters.';
  end if;

  select id, email, staff_name, employee_code, role
  into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    raise exception 'Account profile was not found.';
  end if;

  v_password_hash := crypt(v_password, gen_salt('bf'));

  update public.profiles
  set
    password_hash = v_password_hash,
    updated_at = now()
  where id = p_profile_id;

  perform public.ensure_staff_auth_user(
    p_profile_id,
    v_profile.email,
    v_password_hash,
    v_profile.staff_name,
    v_profile.employee_code,
    v_profile.role::text
  );

  return jsonb_build_object(
    'userId', p_profile_id,
    'role', v_profile.role,
    'passwordUpdated', true
  );
end
$$;

revoke all on function public.update_staff_profile_password(uuid, text) from public;
grant execute on function public.update_staff_profile_password(uuid, text) to authenticated;

create or replace function public.delete_staff_account(
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_profile record;
  v_location_id text;
  v_shared_location_count integer := 0;
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'Only admin accounts can delete staff accounts.'
      using errcode = '42501';
  end if;

  if auth.uid() = p_profile_id then
    raise exception 'You cannot delete the admin account you are signed in with.';
  end if;

  select id, role, assigned_location_id
  into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    raise exception 'This account was already deleted or could not be found.';
  end if;

  v_location_id := case
    when v_profile.role in ('branch', 'kitchen') then v_profile.assigned_location_id
    else null
  end;

  if v_location_id is not null then
    select count(*)
    into v_shared_location_count
    from public.profiles
    where assigned_location_id = v_location_id
      and id <> p_profile_id;
  end if;

  delete from auth.users where id = p_profile_id;

  if v_location_id is not null and v_shared_location_count = 0 then
    delete from public.locations where id = v_location_id;

    if not found then
      update public.locations
      set active = false, updated_at = now()
      where id = v_location_id;
    end if;
  end if;

  return jsonb_build_object(
    'userId', p_profile_id,
    'deleted', true
  );
end
$$;

revoke all on function public.delete_staff_account(uuid) from public;
grant execute on function public.delete_staff_account(uuid) to authenticated;
