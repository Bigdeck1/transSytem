-- ============================================================================
-- JRR TRANSPORT SYSTEM — MIGRATION V4: MULTI-STOP DISPATCH, RTO & TMS FEATURES
-- Run this script in your Supabase SQL Editor.
-- ============================================================================

-- 1. MULTI-STOP DELIVERY RUNS & STOPS TABLE
CREATE TABLE IF NOT EXISTS public.trip_stops (
  id bigserial PRIMARY KEY,
  trip_id bigint NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  stop_sequence integer NOT NULL DEFAULT 1,
  stop_type text NOT NULL DEFAULT 'dropoff' CHECK (stop_type IN ('pickup', 'dropoff', 'waypoint')),
  location_name text NOT NULL,
  address text NOT NULL,
  latitude numeric,
  longitude numeric,
  contact_person text,
  contact_phone text,
  cargo_description text,
  package_weight_kg numeric,
  tracking_code varchar(32) UNIQUE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in-transit', 'arrived', 'delivered', 'failed', 'skipped')),
  failed_reason text,
  failed_photo_url text,
  pod_recipient_name text,
  pod_signature_data text,
  pod_photo_url text,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

GRANT ALL ON TABLE public.trip_stops TO postgres, service_role, authenticated, anon;
ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for trip_stops" ON public.trip_stops;
CREATE POLICY "Allow all for trip_stops" ON public.trip_stops FOR ALL USING (true) WITH CHECK (true);

-- 2. VEHICLE PREVENTIVE MAINTENANCE SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
  id bigserial PRIMARY KEY,
  vehicle_id bigint NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_type text NOT NULL CHECK (service_type IN ('engine_oil', 'tire_rotation', 'brake_pads', 'transmission_fluid', 'battery', 'registration_renewal', 'general_checkup')),
  interval_km numeric NOT NULL DEFAULT 5000,
  last_service_odo numeric NOT NULL DEFAULT 0,
  next_due_odo numeric NOT NULL DEFAULT 5000,
  last_service_date date DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'due_soon', 'overdue', 'in_service')),
  notes text,
  created_at timestamptz DEFAULT now()
);

GRANT ALL ON TABLE public.maintenance_schedules TO postgres, service_role, authenticated, anon;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for maintenance_schedules" ON public.maintenance_schedules;
CREATE POLICY "Allow all for maintenance_schedules" ON public.maintenance_schedules FOR ALL USING (true) WITH CHECK (true);

-- 3. CLIENT CONTRACT RATE CARDS & PRICING MATRIX
CREATE TABLE IF NOT EXISTS public.client_rate_cards (
  id bigserial PRIMARY KEY,
  client_id bigint REFERENCES public.clients(id) ON DELETE CASCADE,
  rate_card_name text NOT NULL,
  base_fare numeric(12, 2) NOT NULL DEFAULT 350.00,
  base_distance_km numeric(8, 2) NOT NULL DEFAULT 5.00,
  per_km_rate numeric(12, 2) NOT NULL DEFAULT 35.00,
  dropoff_surcharge_per_stop numeric(12, 2) NOT NULL DEFAULT 80.00,
  min_charge numeric(12, 2) NOT NULL DEFAULT 350.00,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

GRANT ALL ON TABLE public.client_rate_cards TO postgres, service_role, authenticated, anon;
ALTER TABLE public.client_rate_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for client_rate_cards" ON public.client_rate_cards;
CREATE POLICY "Allow all for client_rate_cards" ON public.client_rate_cards FOR ALL USING (true) WITH CHECK (true);

-- 4. ENABLE SUPABASE REALTIME ON NEW TABLES
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_stops;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_schedules;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
