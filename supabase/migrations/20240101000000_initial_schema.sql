-- ─── Initial schema ──────────────────────────────────────────────────────────
-- SRM Carbon Tracker — visitor_logs and user_profiles tables.
-- Apply with: supabase db push   (or paste into Supabase SQL editor)

-- ─── visitor_logs ────────────────────────────────────────────────────────────
-- One row per visitor check-in. Written by the public kiosk (anon role).
-- Read only by authenticated staff, scoped by office via RLS.

create table if not exists public.visitor_logs (
  id             uuid        primary key default gen_random_uuid(),
  created_at     timestamptz not null    default now(),
  visitor_name   text        not null,
  company        text,
  host           text        not null,
  purpose        text,
  visit_date     date        not null,
  arrival_time   time,
  office_name    text        not null,
  from_postcode  text,
  transport_mode text,
  distance_km    numeric(8, 2),
  co2_kg         numeric(8, 4),

  constraint chk_visitor_name_length check (char_length(visitor_name) <= 200),
  constraint chk_host_length         check (char_length(host) <= 200),
  constraint chk_office_length       check (char_length(office_name) <= 100),
  constraint chk_postcode_length     check (char_length(from_postcode) <= 10),
  constraint chk_visit_date          check (visit_date >= '2020-01-01') not valid
  -- NOT VALID: applied retroactively — only enforced on new rows, not existing data
);

comment on table public.visitor_logs is
  'Check-in records written by the public kiosk form. One row per visitor visit.';

-- ─── user_profiles ───────────────────────────────────────────────────────────
-- One row per staff member. Links auth.users (Supabase Auth) to a role + office.
-- Row must exist before the user can access the staff portal — see PortalPage.loadProfile().

create table if not exists public.user_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null check (role in ('receptionist', 'manager', 'admin')),
  office_name text,   -- null = access to all offices (admin only)

  constraint chk_email_length check (char_length(email) <= 320)
);

comment on table public.user_profiles is
  'Staff account profiles. role controls portal access level; office_name scopes data visibility.';
comment on column public.user_profiles.role is
  'receptionist: today+own office. manager: all dates+own office+carbon. admin: all offices+user management.';
comment on column public.user_profiles.office_name is
  'NULL for admins (all offices). Must match a key in the offices map for non-admin roles.';

-- ─── Schema grants ────────────────────────────────────────────────────────────
-- Allow the anon role (used by the kiosk check-in form) to insert visitor_logs.
-- SELECT is intentionally not granted to anon — RLS handles read access for staff.

grant usage  on schema public           to anon;
grant insert on public.visitor_logs     to anon;
grant usage  on schema public           to authenticated;
grant select, insert on public.visitor_logs  to authenticated;
grant select, insert, update, delete    on public.user_profiles to authenticated;
