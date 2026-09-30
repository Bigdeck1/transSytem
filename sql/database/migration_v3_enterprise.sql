-- ============================================================================
-- JRR TRANSPORT SYSTEM — V3 ENTERPRISE EXTENSIONS MIGRATION
-- Adds: e-POD (Proof of Delivery), Public Tracking, Expenses, Incident/SOS
-- ============================================================================

-- 1. EXTEND TRIPS TABLE WITH e-POD AND PUBLIC TRACKING COLUMNS
ALTER TABLE IF EXISTS trips 
  ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(32) UNIQUE,
  ADD COLUMN IF NOT EXISTS pod_recipient_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS pod_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS pod_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS pod_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pod_notes TEXT;

-- Generate unique tracking code for existing trips
UPDATE trips 
SET tracking_code = 'TRK-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 8))
WHERE tracking_code IS NULL;

-- Trigger to automatically assign tracking_code if not provided
CREATE OR REPLACE FUNCTION generate_trip_tracking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_code IS NULL OR NEW.tracking_code = '' THEN
    NEW.tracking_code := 'TRK-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trip_tracking_code ON trips;
CREATE TRIGGER trg_trip_tracking_code
BEFORE INSERT ON trips
FOR EACH ROW
EXECUTE FUNCTION generate_trip_tracking_code();

-- 2. CREATE TRIP_EXPENSES TABLE (Fuel, Tolls, Parking)
CREATE TABLE IF NOT EXISTS trip_expenses (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT REFERENCES trips(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
  expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN ('fuel', 'toll', 'parking', 'maintenance', 'other')),
  amount NUMERIC(12, 2) NOT NULL,
  liters NUMERIC(8, 2),
  odometer NUMERIC(10, 1),
  receipt_photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip ON trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_driver ON trip_expenses(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_vehicle ON trip_expenses(vehicle_id);

-- 3. CREATE INCIDENT_REPORTS TABLE (Accidents, Breakdowns, SOS Alerts)
CREATE TABLE IF NOT EXISTS incident_reports (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT REFERENCES trips(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
  severity VARCHAR(30) NOT NULL DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'critical', 'sos')),
  incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('accident', 'breakdown', 'theft', 'medical', 'weather', 'sos_panic', 'other')),
  description TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  photos JSONB DEFAULT '[]'::JSONB,
  police_report_no VARCHAR(100),
  status VARCHAR(30) DEFAULT 'reported' CHECK (status IN ('reported', 'under_review', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_driver ON incident_reports(driver_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON incident_reports(status);

-- 4. ENABLE REALTIME ON NEW TABLES
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trip_expenses;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE incident_reports;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
