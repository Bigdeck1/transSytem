-- ============================================================================
-- JRR TRANSPORT SYSTEM — COMPLETE ENTERPRISE MASTER DATABASE MIGRATION
-- Copy and run this ENTIRE script in your Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. REALTIME DRIVER GPS LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  vehicle_id bigint REFERENCES public.vehicles(id) ON DELETE SET NULL,
  trip_id bigint REFERENCES public.trips(id) ON DELETE SET NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  speed numeric DEFAULT 0,
  heading numeric DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);

-- Grant full access to authenticated and anon roles for driver location streaming
GRANT ALL ON TABLE public.driver_locations TO postgres, service_role, authenticated, anon;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of driver locations" ON public.driver_locations;
CREATE POLICY "Allow public read of driver locations"
ON public.driver_locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all users to upsert driver locations" ON public.driver_locations;
CREATE POLICY "Allow all users to upsert driver locations"
ON public.driver_locations FOR ALL USING (true) WITH CHECK (true);

-- 2. VEHICLE SAFETY ASSESSMENTS TABLE
CREATE TABLE IF NOT EXISTS public.vehicle_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id bigint NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  inspector_id uuid NOT NULL REFERENCES public.employees(id),
  trip_id bigint REFERENCES public.trips(id) ON DELETE SET NULL,
  assessment_type text NOT NULL CHECK (assessment_type IN ('pre_trip', 'post_trip', 'periodic_audit')),
  odometer_reading numeric NOT NULL,
  fuel_level_percentage integer CHECK (fuel_level_percentage BETWEEN 0 AND 100),
  checklist jsonb NOT NULL,
  has_critical_failure boolean DEFAULT false,
  status text NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
  damage_notes text,
  photo_urls text[] DEFAULT '{}',
  inspector_signature text,
  created_at timestamp with time zone DEFAULT now()
);

GRANT ALL ON TABLE public.vehicle_assessments TO postgres, service_role, authenticated, anon;
ALTER TABLE public.vehicle_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for vehicle_assessments" ON public.vehicle_assessments;
CREATE POLICY "Allow all for vehicle_assessments" ON public.vehicle_assessments FOR ALL USING (true) WITH CHECK (true);

-- 3. TRIP EXPENSES TABLE (Fuel, Tolls, Parking)
CREATE TABLE IF NOT EXISTS public.trip_expenses (
  id bigserial PRIMARY KEY,
  trip_id bigint REFERENCES public.trips(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  vehicle_id bigint REFERENCES public.vehicles(id) ON DELETE SET NULL,
  expense_type text NOT NULL CHECK (expense_type IN ('fuel', 'toll', 'parking', 'maintenance', 'other')),
  amount numeric(12, 2) NOT NULL,
  liters numeric(8, 2),
  odometer numeric(10, 1),
  receipt_photo_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

GRANT ALL ON TABLE public.trip_expenses TO postgres, service_role, authenticated, anon;
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for trip_expenses" ON public.trip_expenses;
CREATE POLICY "Allow all for trip_expenses" ON public.trip_expenses FOR ALL USING (true) WITH CHECK (true);

-- 4. INCIDENT & ROAD DEFECT REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id bigserial PRIMARY KEY,
  trip_id bigint REFERENCES public.trips(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  vehicle_id bigint REFERENCES public.vehicles(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'critical', 'sos')),
  incident_type text NOT NULL CHECK (incident_type IN ('accident', 'breakdown', 'theft', 'medical', 'weather', 'sos_panic', 'other')),
  description text NOT NULL,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  photos jsonb DEFAULT '[]'::jsonb,
  police_report_no text,
  status text DEFAULT 'reported' CHECK (status IN ('reported', 'under_review', 'resolved')),
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

GRANT ALL ON TABLE public.incident_reports TO postgres, service_role, authenticated, anon;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for incident_reports" ON public.incident_reports;
CREATE POLICY "Allow all for incident_reports" ON public.incident_reports FOR ALL USING (true) WITH CHECK (true);

-- 5. EXTEND TRIPS TABLE WITH ALL ENTERPRISE COLUMNS
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS hq_address text DEFAULT 'Malalim St, Sitio Malalim, Morong, 1960 Rizal',
ADD COLUMN IF NOT EXISTS hq_lat numeric DEFAULT 14.546827,
ADD COLUMN IF NOT EXISTS hq_lng numeric DEFAULT 121.229383,
ADD COLUMN IF NOT EXISTS pickup_lat numeric,
ADD COLUMN IF NOT EXISTS pickup_lng numeric,
ADD COLUMN IF NOT EXISTS delivery_lat numeric,
ADD COLUMN IF NOT EXISTS delivery_lng numeric,
ADD COLUMN IF NOT EXISTS leg1_distance_km numeric,
ADD COLUMN IF NOT EXISTS leg1_duration_mins integer,
ADD COLUMN IF NOT EXISTS leg2_distance_km numeric,
ADD COLUMN IF NOT EXISTS leg2_duration_mins integer,
ADD COLUMN IF NOT EXISTS total_est_duration_mins integer,
ADD COLUMN IF NOT EXISTS package_length_cm numeric,
ADD COLUMN IF NOT EXISTS package_width_cm numeric,
ADD COLUMN IF NOT EXISTS package_height_cm numeric,
ADD COLUMN IF NOT EXISTS package_weight_kg numeric,
ADD COLUMN IF NOT EXISTS volumetric_weight_kg numeric,
ADD COLUMN IF NOT EXISTS chargeable_weight_kg numeric,
ADD COLUMN IF NOT EXISTS estimated_fare numeric,
ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(32) UNIQUE,
ADD COLUMN IF NOT EXISTS pod_recipient_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS pod_signature_data TEXT,
ADD COLUMN IF NOT EXISTS pod_photo_url TEXT,
ADD COLUMN IF NOT EXISTS pod_delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pod_notes TEXT;

-- Auto-generate tracking code for any existing trips without one
UPDATE public.trips 
SET tracking_code = 'TRK-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 8))
WHERE tracking_code IS NULL;

-- 6. ENABLE REALTIME BROADCASTING ON RELEVANT TABLES
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_reports;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_expenses;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_devices;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_device_requests;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.api_configurations;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 8. IOT HARDWARE FLEET TELEMETRY TABLES
CREATE TABLE IF NOT EXISTS public.iot_devices (
  id BIGSERIAL PRIMARY KEY,
  device_serial TEXT NOT NULL UNIQUE,
  vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  device_type TEXT NOT NULL DEFAULT 'GPS + Cold-Chain Temp + Cargo Door',
  connectivity_type TEXT DEFAULT '4G LTE / GSM (SIM800L / A7670)',
  firmware_version TEXT DEFAULT 'v1.2.0-esp32',
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance', 'unpaired')),
  battery_voltage NUMERIC(4, 2) DEFAULT 12.6,
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  config JSONB DEFAULT '{"interval_seconds": 10, "temp_threshold_high": 8.0, "temp_threshold_low": 2.0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON TABLE public.iot_devices TO postgres, service_role, authenticated, anon;
ALTER TABLE public.iot_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for iot_devices" ON public.iot_devices;
CREATE POLICY "Allow all for iot_devices" ON public.iot_devices FOR ALL USING (true) WITH CHECK (true);

-- 9. DRIVER PHONE EMBEDDING & DEVICE LOCK (1 DEVICE PER DRIVER)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS bound_device_id TEXT,
ADD COLUMN IF NOT EXISTS bound_device_model TEXT,
ADD COLUMN IF NOT EXISTS bound_device_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS device_lock_enabled BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS public.driver_device_requests (
  id BIGSERIAL PRIMARY KEY,
  driver_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  current_device_id TEXT,
  new_device_id TEXT NOT NULL,
  new_device_model TEXT,
  reason TEXT DEFAULT 'Driver switched or replaced mobile device',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT
);

GRANT ALL ON TABLE public.driver_device_requests TO postgres, service_role, authenticated, anon;
ALTER TABLE public.driver_device_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for driver_device_requests" ON public.driver_device_requests;
CREATE POLICY "Allow all for driver_device_requests" ON public.driver_device_requests FOR ALL USING (true) WITH CHECK (true);

-- 10. SUPER ADMIN API CONFIGURATION & GATEWAY MANAGEMENT
CREATE TABLE IF NOT EXISTS public.api_configurations (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('backend', 'database', 'maps', 'iot', 'smtp', 'notifications')),
  label TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  api_key TEXT,
  secret_key TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'testing', 'error')),
  last_tested_at TIMESTAMPTZ,
  last_status_code INTEGER DEFAULT 200,
  updated_by TEXT DEFAULT 'super_admin',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON TABLE public.api_configurations TO postgres, service_role, authenticated, anon;
ALTER TABLE public.api_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for api_configurations" ON public.api_configurations;
CREATE POLICY "Allow all for api_configurations" ON public.api_configurations FOR ALL USING (true) WITH CHECK (true);

-- 11. USER GOVERNANCE & APPROVAL SYSTEM
DO $$
BEGIN
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE public.users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('super_admin', 'admin', 'operations_admin', 'dispatcher', 'rental_manager', 'billing_clerk', 'driver', 'user'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS bound_device_id TEXT,
  ADD COLUMN IF NOT EXISTS bound_device_model TEXT,
  ADD COLUMN IF NOT EXISTS bound_device_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_lock_enabled BOOLEAN DEFAULT true;

-- Auto-approve any existing super_admin/admin accounts
UPDATE public.users 
SET status = 'approved', is_approved = true, email_verified = true 
WHERE role IN ('super_admin', 'admin') AND status = 'pending';

-- 12. AUTOMATIC TRIGGER FOR DRIVER DEVICE LOCK ENFORCEMENT
CREATE OR REPLACE FUNCTION public.apply_driver_device_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.employees
    SET bound_device_id = NEW.new_device_id,
        bound_device_model = COALESCE(NEW.new_device_model, bound_device_model),
        bound_device_at = NOW(),
        device_lock_enabled = true
    WHERE id = NEW.driver_id;
    
    NEW.reviewed_at = COALESCE(NEW.reviewed_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_driver_device_lock ON public.driver_device_requests;
CREATE TRIGGER trg_driver_device_lock
  BEFORE UPDATE ON public.driver_device_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_driver_device_lock();

-- 13. FORCE POSTGREST TO RELOAD SCHEMA CACHE IMMEDIATELY
NOTIFY pgrst, 'reload schema';
