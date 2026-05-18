# SRM Carbon Tracker — To-Do & Recommendations

Tracked actions, improvements, and open security hardening tasks.
Items are grouped by category and marked with a priority: 🔴 High / 🟡 Medium / 🟢 Low.

---

## Security

- [ ] 🔴 **Rate-limit anonymous check-in submissions**
  Currently anyone with the Supabase anon key can INSERT unlimited rows into `visitor_logs`. Options:
  - Wrap the insert in a Supabase Edge Function that enforces a per-IP rate limit
  - Use Cloudflare Rate Limiting rules in front of the Netlify site
  - Add a signed short-lived token (generated server-side) required for each submission

- [ ] 🔴 **Move staff user creation to a Supabase Edge Function**
  `UsersPage` currently calls `sb.auth.signUp` client-side using the anon key. If Supabase email confirmation is disabled, any visitor who knows the anon key could create accounts. Fix: create a protected Edge Function that only authenticated admins can call, and have it create the auth user + profile server-side.

- [ ] 🟡 **Remove `unsafe-inline` from Content Security Policy**
  The current CSP (`netlify.toml`) includes `unsafe-inline` for both `script-src` and `style-src`, which weakens XSS protection. Fix requires:
  1. Moving all inline `style={{...}}` props to CSS classes
  2. Implementing CSP nonces via a Netlify Edge Function for any remaining inline scripts

- [ ] 🟡 **Add a portal session timeout**
  Authenticated sessions in `PortalPage` persist indefinitely (until the browser tab is closed or the user manually signs out). For offices where staff share a workstation, a 30–60 minute inactivity timeout would prevent another person from accessing data on an unattended tab. Supabase supports configurable JWT expiry in project settings.

- [ ] 🟢 **Add audit logging for admin actions**
  Admin actions (creating users, changing office settings) are not currently logged anywhere. A lightweight `audit_log` table (actor, action, detail, timestamp) would provide a trail for compliance purposes.

---

## Features

- [ ] 🟡 **Auto-refresh the visitor log in the portal**
  The visitors table does not update in real time — staff must manually reload or re-apply the filter to see new check-ins. Options:
  - Poll every 60 seconds with a `setInterval`
  - Use Supabase Realtime (`sb.channel(...).on('postgres_changes', ...)`) for instant updates

- [ ] 🟡 **GDPR erasure / data deletion UI**
  There is no way to delete visitor records from within the portal. For GDPR right-to-erasure requests, records must currently be deleted directly in the Supabase dashboard. An admin-only "Delete record" button in the visitor log table would be safer and more auditable.

- [ ] 🟡 **Password reset flow for staff**
  Staff currently cannot reset their own password from the portal login screen. Add a "Forgot password?" link that calls `sb.auth.resetPasswordForEmail()` to send a Supabase-managed reset email.

- [ ] 🟡 **Staff can update their own password**
  Once logged in, staff have no way to change their password from within the portal. A simple "Change password" option in a profile/settings area using `sb.auth.updateUser({ password: newPassword })` would address this.

- [ ] 🟢 **Visitor log search / filter by name or host**
  Currently the only filter is a date range. Adding a text search field (filtering client-side on the loaded rows, or adding `.ilike('visitor_name', '%...%')` to the Supabase query) would help receptionists quickly find a specific visitor.

- [ ] 🟢 **Carbon trend chart over time**
  The Carbon Report page shows totals and breakdowns but no time-series view. A simple line chart of monthly CO₂ totals (using a lightweight library like Chart.js or Recharts) would make trends visible for sustainability reporting.

- [ ] 🟢 **Export carbon report as PDF or CSV**
  The Carbon Report page has no export option. Adding a CSV or printable PDF export of the aggregated carbon data would be useful for ESG/sustainability reporting submissions.

- [ ] 🟢 **Multi-day / return journey option**
  The current form logs a one-way journey. Visitors who return the same day double the carbon footprint. A "Return journey?" checkbox that multiplies the CO₂ result by 2 before saving would improve accuracy.

---

## Operations

- [ ] 🟡 **Document the EmailJS template setup**
  The README / CLAUDE.md lists the template variable names but there is no step-by-step guide for creating the EmailJS account, service, and template from scratch. A short setup guide with screenshots would reduce onboarding time for a new administrator.

- [ ] 🟡 **Set a Supabase data retention policy**
  The GDPR note on the check-in form states data is retained for 12 months. This is not currently enforced — records stay in the database indefinitely. A Supabase scheduled function (pg_cron) or an external cron job that deletes rows where `visit_date < now() - interval '12 months'` would make this compliant with the stated policy.

- [ ] 🟢 **Set up Supabase database backups**
  Confirm that Supabase's automatic daily backups are enabled for the project (available on the Pro plan). If on the free plan, implement a periodic export via the Supabase Management API or CLI to an external store (e.g. S3 or Google Drive).

- [ ] 🟢 **Add Netlify deploy notifications**
  Configure Netlify to send a Slack or email notification on deploy success/failure so the team is aware when the site updates or a build breaks.

---

## Code Quality & Maintenance

- [ ] 🟡 **Add unit tests for carbon calculation logic**
  `carbon.js` (emission factors, Haversine formula, `validUKPostcode`) contains pure functions that are straightforward to unit test with Vitest. A test suite would catch regressions if factors or formula are updated.

- [ ] 🟢 **Replace `window.confirm` in TabOffices with an in-UI confirmation**
  The delete office action uses a native `window.confirm` dialog which is blocked in some browser environments (embedded WebViews, certain kiosk modes) and looks out of place with the app's design. Replacing it with a small inline confirmation (`"Are you sure? [Yes] [Cancel]"`) would be more robust.

- [ ] 🟢 **Lazy-load portal page components**
  `VisitorsPage`, `CarbonPage`, and `UsersPage` are all bundled into the main chunk. Using `React.lazy()` and `Suspense` would split them into separate chunks and reduce the initial bundle size — particularly useful on slow kiosk network connections.

- [ ] 🟢 **Pin dependency versions for reproducible builds**
  `package.json` currently uses `^` ranges. Locking to exact versions (or using `npm ci` and committing `package-lock.json` explicitly) would prevent a dependency update from unexpectedly breaking a production build.
