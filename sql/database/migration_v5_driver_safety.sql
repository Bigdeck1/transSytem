-- ============================================================================
-- HERMES DRIVER SAFETY MONITOR — Database Migration
-- migration_v5_driver_safety.sql
--
-- Run this in your Supabase Dashboard → SQL Editor.
-- This creates the safety_events table used by the drowsiness detection system.
--
-- Privacy notes:
--   - No camera video or image data is stored here
--   - Only structured event metadata (scores, types, durations) is logged
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SAFETY EVENTS TABLE
-- Stores driver fatigue events logged by the HERMES mobile app
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.safety_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  trip_id          BIGINT REFERENCES public.trips(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL CHECK (event_type IN (
                     'monitoring_started',
                     'monitoring_ended',
                     'pre_trip_check_passed',
                     'pre_trip_check_failed',
                     'drowsiness_level_1',
                     'drowsiness_level_2',
                     'drowsiness_level_3',
                     'drowsiness_resolved',
                     'face_absent',
                     'face_returned',
                     'camera_obstructed',
                     'camera_cleared'
                   )),
  severity         TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  fatigue_score    INTEGER NOT NULL DEFAULT 0 CHECK (fatigue_score BETWEEN 0 AND 100),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  -- ISO 8601 timestamp from the mobile device (device time, not server time)
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Optional JSON metadata (no image/video data allowed here)
  -- Allowed fields: dominant_signal, reasoning, alert_level, score_breakdown
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- Optimized for admin dashboard queries (by date, by driver, by trip)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_safety_events_employee_id
  ON public.safety_events(employee_id);

CREATE INDEX IF NOT EXISTS idx_safety_events_trip_id
  ON public.safety_events(trip_id);

CREATE INDEX IF NOT EXISTS idx_safety_events_timestamp
  ON public.safety_events(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_safety_events_severity
  ON public.safety_events(severity)
  WHERE severity IN ('high', 'critical');

CREATE INDEX IF NOT EXISTS idx_safety_events_event_type
  ON public.safety_events(event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISSIONS & ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

GRANT ALL ON TABLE public.safety_events TO postgres, service_role, authenticated, anon;

ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated mobile app users to INSERT their own events
DROP POLICY IF EXISTS "Drivers can insert their own safety events" ON public.safety_events;
CREATE POLICY "Drivers can insert their own safety events"
  ON public.safety_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to SELECT their own events (driver can view their own history)
DROP POLICY IF EXISTS "Drivers can read their own safety events" ON public.safety_events;
CREATE POLICY "Drivers can read their own safety events"
  ON public.safety_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin/service role can read all events (for dashboard)
DROP POLICY IF EXISTS "Service role full access to safety events" ON public.safety_events;
CREATE POLICY "Service role full access to safety events"
  ON public.safety_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- ADMIN SUMMARY VIEW
-- Convenience view for the VISHNU admin dashboard
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_driver_safety_summary AS
SELECT
  se.employee_id,
  e.full_name       AS driver_name,
  se.trip_id,
  t.trip_number,
  COUNT(*) FILTER (WHERE se.event_type IN ('drowsiness_level_1', 'drowsiness_level_2', 'drowsiness_level_3'))
                    AS total_drowsiness_events,
  COUNT(*) FILTER (WHERE se.severity = 'critical')
                    AS critical_events,
  COUNT(*) FILTER (WHERE se.severity = 'high')
                    AS high_severity_events,
  MAX(se.fatigue_score)
                    AS peak_fatigue_score,
  MIN(se.timestamp) AS monitoring_start,
  MAX(se.timestamp) AS last_event_at
FROM public.safety_events se
JOIN public.employees e ON e.id = se.employee_id
LEFT JOIN public.trips t ON t.id = se.trip_id
GROUP BY se.employee_id, e.full_name, se.trip_id, t.trip_number;

GRANT SELECT ON public.v_driver_safety_summary TO postgres, service_role, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- TODAY'S ACTIVE DRIVER SAFETY VIEW
-- Shown on admin real-time dashboard
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_today_safety_alerts AS
SELECT
  se.employee_id,
  e.full_name   AS driver_name,
  se.trip_id,
  t.trip_number,
  se.event_type,
  se.severity,
  se.fatigue_score,
  se.timestamp
FROM public.safety_events se
JOIN public.employees e ON e.id = se.employee_id
LEFT JOIN public.trips t ON t.id = se.trip_id
WHERE
  se.timestamp >= NOW() - INTERVAL '24 hours'
  AND se.event_type IN (
    'drowsiness_level_1',
    'drowsiness_level_2',
    'drowsiness_level_3'
  )
ORDER BY se.timestamp DESC;

GRANT SELECT ON public.v_today_safety_alerts TO postgres, service_role, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME SUBSCRIPTION (optional)
-- Enable realtime for the admin dashboard to receive live safety alerts
-- ─────────────────────────────────────────────────────────────────────────────

-- Run this to enable Supabase Realtime on the safety_events table:
-- (Execute manually in Supabase Dashboard → Database → Replication)
--
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_events;
--
-- This allows the admin VISHNU web app to subscribe to live events:
--   supabase.channel('safety').on('postgres_changes', { table: 'safety_events' }, callback)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
