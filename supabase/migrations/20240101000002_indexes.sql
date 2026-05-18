-- ─── Performance indexes ──────────────────────────────────────────────────────
-- visitor_logs is queried heavily by date range and office in the portal.
-- Without indexes these become full sequential scans as the table grows.
--
-- At ~50 check-ins/day across 8 offices: ~18,000 rows/year.
-- The date + office index will keep portal queries sub-10ms at this scale.

-- Most portal queries filter by visit_date (date range) — used by VisitorsPage
-- and CarbonPage. Also used for the receptionist "today only" filter.
create index if not exists idx_visitor_logs_visit_date
  on public.visitor_logs (visit_date desc);

-- Managers and receptionists always filter by office_name.
-- Combined with visit_date for the common (office + date range) query pattern.
create index if not exists idx_visitor_logs_office_date
  on public.visitor_logs (office_name, visit_date desc);

-- created_at is used for the default ORDER BY in VisitorsPage (newest first).
create index if not exists idx_visitor_logs_created_at
  on public.visitor_logs (created_at desc);

-- CarbonPage queries transport_mode for the breakdown aggregation.
create index if not exists idx_visitor_logs_transport
  on public.visitor_logs (transport_mode);

-- user_profiles is tiny (tens of rows) — no indexes needed beyond the PK.
-- If the user base grows significantly, add: create index on user_profiles (role);
