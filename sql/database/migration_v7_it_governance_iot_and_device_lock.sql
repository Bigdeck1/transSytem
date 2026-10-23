-- ============================================================================
-- JRR TRANSPORT SYSTEM — MIGRATION V7: IT GOVERNANCE, IOT & DRIVER DEVICE LOCK
-- Run this script in your Supabase SQL Editor.
-- ============================================================================

-- 1. IOT HARDWARE FLEET TELEMETRY TABLES
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

-- IoT Telemetry Time-Series Logs
CREATE TABLE IF NOT EXISTS public.iot_telemetry_logs (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  speed NUMERIC(5, 2) DEFAULT 0,
  satellites INTEGER DEFAULT 0,
  cargo_temp NUMERIC(5, 2),
  cargo_humidity NUMERIC(5, 2),
  cargo_door_closed BOOLEAN DEFAULT true,
  battery_voltage NUMERIC(4, 2) DEFAULT 12.6,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iot_telemetry_device ON public.iot_telemetry_logs(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iot_telemetry_vehicle ON public.iot_telemetry_logs(vehicle_id, created_at DESC);

GRANT ALL ON TABLE public.iot_telemetry_logs TO postgres, service_role, authenticated, anon;
ALTER TABLE public.iot_telemetry_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for iot_telemetry_logs" ON public.iot_telemetry_logs;
CREATE POLICY "Allow all for iot_telemetry_logs" ON public.iot_telemetry_logs FOR ALL USING (true) WITH CHECK (true);

-- 2. DRIVER PHONE EMBEDDING & DEVICE LOCK (1 DEVICE PER DRIVER)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS bound_device_id TEXT,
ADD COLUMN IF NOT EXISTS bound_device_model TEXT,
ADD COLUMN IF NOT EXISTS bound_device_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS device_lock_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS bound_device_id TEXT,
ADD COLUMN IF NOT EXISTS bound_device_model TEXT,
ADD COLUMN IF NOT EXISTS bound_device_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS device_lock_enabled BOOLEAN DEFAULT true;

-- Driver Device Change & Transfer Requests Table
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

CREATE INDEX IF NOT EXISTS idx_driver_device_req_status ON public.driver_device_requests(status, requested_at DESC);

GRANT ALL ON TABLE public.driver_device_requests TO postgres, service_role, authenticated, anon;
ALTER TABLE public.driver_device_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for driver_device_requests" ON public.driver_device_requests;
CREATE POLICY "Allow all for driver_device_requests" ON public.driver_device_requests FOR ALL USING (true) WITH CHECK (true);

-- 3. SUPER ADMIN API CONFIGURATION & GATEWAY MANAGEMENT
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

-- Seed Default API Endpoints for Super Admin
INSERT INTO public.api_configurations (key, category, label, endpoint_url, status)
VALUES
  ('express_backend', 'backend', 'JRR Express Server Gateway', 'http://localhost:3000', 'active'),
  ('supabase_db', 'database', 'Supabase Database Endpoint', 'https://uocavssoqmwjstmvdgwq.supabase.co', 'active'),
  ('osrm_routing', 'maps', 'OSRM Route Optimization Engine', 'https://router.project-osrm.org', 'active'),
  ('iot_telemetry', 'iot', 'ESP32 Ingestion Webhook', '/api/tracking/iot/telemetry', 'active'),
  ('smtp_mail', 'smtp', 'SMTP Verification Gateway (smtp.gmail.com)', 'smtp://smtp.gmail.com:587', 'active')
ON CONFLICT (key) DO UPDATE 
SET endpoint_url = EXCLUDED.endpoint_url,
    updated_at = NOW();

-- 4. ARCHIVE LEGACY PAYROLL / MONEY TABLES
-- Safely flags or notes archival so system focus stays on core dispatch, operations, fleet, and IoT.
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payrolls') THEN
    ALTER TABLE public.payrolls ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT true;
    COMMENT ON TABLE public.payrolls IS 'ARCHIVED: Payroll and money tracking deprecated to focus on operational dispatch and logistics.';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') THEN
    ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 5. REALTIME BROADCASTING SETUP
DO $$
BEGIN
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

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
