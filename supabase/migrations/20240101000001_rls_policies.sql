-- ─── Row Level Security policies ─────────────────────────────────────────────
-- All data access is controlled here. The anon key is public — RLS is the
-- only thing preventing arbitrary reads or writes from the browser.

-- ─── visitor_logs ────────────────────────────────────────────────────────────

alter table public.visitor_logs enable row level security;

-- Allow the kiosk check-in form (anon role) to insert new records.
-- No conditions — any anon user can insert. Rate limiting is handled by the
-- check-in Edge Function (see supabase/functions/check-in/).
create policy "visitor_logs_anon_insert"
  on public.visitor_logs
  for insert
  to anon
  with check (true);

-- Allow authenticated staff to insert (e.g. manual entry from the portal).
create policy "visitor_logs_auth_insert"
  on public.visitor_logs
  for insert
  to authenticated
  with check (true);

-- Staff can only read records for their assigned office.
-- Admins (office_name IS NULL in user_profiles) see all records.
-- This policy works in tandem with the client-side office filter in VisitorsPage
-- as a defence-in-depth measure.
create policy "visitor_logs_staff_select"
  on public.visitor_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and (up.office_name is null or up.office_name = visitor_logs.office_name)
    )
  );

-- Only admins can delete visitor records (e.g. GDPR erasure requests).
create policy "visitor_logs_admin_delete"
  on public.visitor_logs
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.role = 'admin'
    )
  );

-- ─── user_profiles ───────────────────────────────────────────────────────────

alter table public.user_profiles enable row level security;

-- Every authenticated user can read their own profile row.
-- Used by PortalPage.loadProfile() on sign-in to retrieve role + office.
create policy "user_profiles_self_select"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Admins can read all profiles (for the Manage Users page in the portal).
create policy "user_profiles_admin_select"
  on public.user_profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.role = 'admin'
    )
  );

-- Only admins can insert new profiles.
-- In production this should be moved to a server-side Edge Function
-- (see supabase/functions/create-user/) so the service role key is never
-- exposed to the browser.
create policy "user_profiles_admin_insert"
  on public.user_profiles
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.role = 'admin'
    )
  );

-- Only admins can update profiles (e.g. role changes, office reassignment).
create policy "user_profiles_admin_update"
  on public.user_profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.role = 'admin'
    )
  );

-- Only admins can delete profiles.
create policy "user_profiles_admin_delete"
  on public.user_profiles
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.role = 'admin'
    )
  );
