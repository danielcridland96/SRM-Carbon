# SRM Carbon Tracker — To-Do & Recommendations

Tracked actions, improvements, and open security hardening tasks.
Items are grouped by category and marked with a priority: 🔴 High / 🟡 Medium / 🟢 Low.
Items marked ✅ have been implemented.

---

## Security

- [ ] 🔴 **Wire up the check-in Edge Function** (`supabase/functions/check-in/`)
  The function is written and ready to deploy. It adds server-side rate limiting
  and validation to the check-in form. Steps to activate:
  1. `supabase functions deploy check-in`
  2. Set `VITE_CHECKIN_FUNCTION_URL` in the Netlify environment variables
  3. Update `CheckInPage.submit()` to POST to the function URL instead of calling
     `sb.from('visitor_logs').insert(rec)` directly
  4. Once confirmed working, revoke the anon INSERT grant on `visitor_logs`

- [ ] 🔴 **Wire up the create-user Edge Function** (`supabase/functions/create-user/`)
  The function is written and ready to deploy. It moves user creation server-side
  so the service role key is never exposed in the browser. Steps to activate:
  1. `supabase functions deploy create-user`
  2. Update `UsersPage.createUser()` to POST to the function URL with the user's
     JWT in the Authorization header, instead of calling `sb.auth.signUp()` directly

- [ ] 🟡 **Remove `unsafe-inline` from Content Security Policy** (`netlify.toml`)
  Requires moving all inline `style={{...}}` props to CSS classes and implementing
  CSP nonces via a Netlify Edge Function for any remaining inline scripts.

- [ ] 🟡 **Add a portal session timeout**
  Configure JWT expiry in Supabase (`supabase/config.toml` → `[auth] jwt_expiry`)
  and add an inactivity listener in `PortalPage` to sign out after ~30 minutes.

- [ ] 🟢 **Add audit logging for admin actions**
  Create an `audit_log` table (actor, action, detail, timestamp) and insert a row
  from the Edge Functions on: user creation, user deletion, office changes.

- [ ] 🟢 **Enable MFA for admin and manager accounts**
  Supabase Auth supports TOTP MFA. Enable it in the Supabase dashboard
  (Authentication → Settings → Multi-Factor Authentication) and enforce it in
  `PortalPage.loadProfile()` for roles other than receptionist.

---

## Database

- ✅ **Supabase migrations tracked in source control** (`supabase/migrations/`)
  Schema, RLS policies, and indexes are now versioned SQL files.
  Apply to a new environment with `supabase db push`.

- ✅ **Performance indexes added** (`supabase/migrations/20240101000002_indexes.sql`)
  Indexes on `visit_date`, `office_name + visit_date`, `created_at`, and
  `transport_mode` for efficient portal queries as the table grows.

- [ ] 🟡 **Apply migrations to the live database**
  The migration files are written but have not been pushed to the live Supabase
  project. Run: `supabase db push` — or paste the SQL files into the SQL editor.
  Indexes especially should be applied soon; they are safe to add to a live table.

- [ ] 🟡 **Enforce 12-month data retention** (GDPR compliance)
  The check-in form states data is retained for 12 months. This is not currently
  enforced. Enable `pg_cron` in the Supabase dashboard and add a scheduled job:
  ```sql
  select cron.schedule(
    'delete-old-visitor-logs',
    '0 2 * * *',  -- 02:00 UTC daily
    $$delete from visitor_logs where visit_date < current_date - interval '12 months'$$
  );
  ```

- [ ] 🟢 **Confirm Supabase backups are enabled**
  The free plan does not include PITR backups. Upgrade to Pro, or implement a
  periodic export via `supabase db dump` to an external store (S3 / Google Drive).

---

## Features

- [ ] 🟡 **Auto-refresh the visitor log in the portal**
  The visitors table does not update in real time — staff must manually reload
  or re-apply the filter. Options:
  - Poll every 60 seconds with a `setInterval`
  - Use Supabase Realtime (`sb.channel(...).on('postgres_changes', ...)`)

- [ ] 🟡 **GDPR erasure / data deletion UI**
  Admin-only "Delete record" button in the visitor log table, backed by the
  `visitor_logs_admin_delete` RLS policy already in place.

- [ ] 🟡 **Password reset flow for staff**
  Add a "Forgot password?" link on the portal login screen calling
  `sb.auth.resetPasswordForEmail()` to send a Supabase-managed reset email.

- [ ] 🟡 **Staff can update their own password**
  In-portal "Change password" option using `sb.auth.updateUser({ password })`.

- [ ] 🟢 **Visitor log search / filter by name or host**
  Text search field — either client-side filter on loaded rows, or
  `.ilike('visitor_name', '%...%')` added to the Supabase query.

- [ ] 🟢 **Carbon trend chart over time**
  Monthly CO₂ line chart on the Carbon Report page (Recharts or Chart.js).

- [ ] 🟢 **Export carbon report as PDF or CSV**
  Aggregate carbon data export for ESG/sustainability reporting.

- ✅ **Kiosk auto-reset after check-in**
  Success screen counts down from 15 seconds and automatically resets the form,
  ready for the next visitor. Manual "Log another visitor" button still works immediately.

- [ ] 🟢 **Return journey option**
  Checkbox that doubles the CO₂ figure for visitors travelling both ways on the
  same day.

---

## Operations

- [ ] 🟡 **Document the EmailJS template setup**
  Step-by-step guide (with variable names) for setting up the EmailJS account,
  service, and template from scratch. Add to `CLAUDE.md`.

- [ ] 🟡 **Set up a staging environment**
  Create a second Supabase project and a Netlify preview site for testing changes
  before pushing to production. Netlify Deploy Previews (triggered on PRs) provide
  this for free; they would need their own `VITE_SUPABASE_*` env vars pointing at
  the staging project.

- [ ] 🟡 **Add error monitoring (Sentry)**
  Install `@sentry/react`, wrap the app in `Sentry.init()`, and connect to a
  Sentry project. This gives visibility into client-side errors in production
  without having to dig through user reports.

- [ ] 🟢 **Set up Netlify deploy notifications**
  Configure Netlify to post a Slack or email notification on deploy success/failure.

---

## Code Quality & Maintenance

- ✅ **Vite production build optimisation** (`vite.config.js`)
  Manual chunk splitting separates vendor libraries from app code so browser
  caches stay valid across deploys that only change app code.

- ✅ **Cache headers for hashed assets** (`netlify.toml`)
  `/assets/*` → `immutable, 1 year`. `/index.html` → `no-cache`. SVGs + PNGs → 1 hour.

- ✅ **SRM branding applied**
  Font updated to Source Sans Pro (SRM's brand font). SRM logo added to the check-in
  page header and portal topbar (inverted white in the dark bar). Brand red `#e4032c`
  added as `--srm-red` CSS variable. Heading style unified (italic `em` removed).

- ✅ **Supabase config tracked in source control** (`supabase/config.toml`)

- ✅ **`.env.example` added** — documents required environment variables for new developers.

- ✅ **README replaced** — the default Vite boilerplate README has been replaced with
  project-specific documentation.

- ✅ **`.gitignore` hardened** — now excludes `supabase/.temp/`, `.env.*`, and Windows
  npm cache directories.

- [ ] 🟡 **Add unit tests for carbon calculation logic**
  `carbon.js` contains pure functions (Haversine, `validUKPostcode`, `co2Equivalent`)
  that are straightforward to cover with Vitest. Install with `npm i -D vitest`.

- [ ] 🟢 **Replace `window.confirm` in TabOffices with in-UI confirmation**
  Native `window.confirm` is blocked in some embedded WebViews and kiosk browsers.

- [ ] 🟢 **Lazy-load portal page components**
  Use `React.lazy()` + `Suspense` to split `VisitorsPage`, `CarbonPage`, and
  `UsersPage` into separate chunks — reduces initial bundle size on the kiosk.

- [ ] 🟢 **Pin exact dependency versions**
  Replace `^` ranges in `package.json` with exact versions and commit
  `package-lock.json` to ensure reproducible builds.
