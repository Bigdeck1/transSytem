-- ====================================================================
-- JRR Transport System — Migration v2.0
-- Features: Alarm & Notifications, Package Estimator, Dual-Leg Tracking, Vehicle Assessment
-- ====================================================================

-- 1. NOTIFICATIONS TABLE EXTENSIONS
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'urgent', 'alarm')),
ADD COLUMN IF NOT EXISTS target_role text DEFAULT 'driver' CHECK (target_role IN ('driver', 'admin', 'all')),
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. DEVICE TOKENS FOR PUSH NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  platform text CHECK (platform IN ('ios', 'android', 'web')),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. TRIPS TABLE EXTENSIONS FOR DUAL-LEG TRACKING & PACKAGE ESTIMATION
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS hq_address text DEFAULT 'JRR Main Logistics Depot, Manila',
ADD COLUMN IF NOT EXISTS hq_lat numeric DEFAULT 14.5995,
ADD COLUMN IF NOT EXISTS hq_lng numeric DEFAULT 120.9842,
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
ADD COLUMN IF NOT EXISTS estimated_fare numeric;

-- 4. REALTIME DRIVER GPS LOCATION TRACKING
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  vehicle_id integer REFERENCES public.vehicles(id) ON DELETE SET NULL,
  trip_id bigint REFERENCES public.trips(id) ON DELETE SET NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  speed numeric DEFAULT 0,
  heading numeric DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);

-- 5. VEHICLE ASSESSMENTS (PRE-TRIP / POST-TRIP / PERIODIC INSPECTIONS)
CREATE TABLE IF NOT EXISTS public.vehicle_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id integer NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
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

-- 6. TRIGGER: AUTOMATICALLY TRANSITION VEHICLE TO 'maintenance' IF ASSESSMENT FAILS
CREATE OR REPLACE FUNCTION public.handle_vehicle_assessment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.has_critical_failure = true OR NEW.status = 'failed' THEN
    UPDATE public.vehicles
    SET status = 'maintenance'
    WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_vehicle_assessment_inserted ON public.vehicle_assessments;
CREATE TRIGGER on_vehicle_assessment_inserted
AFTER INSERT ON public.vehicle_assessments
FOR EACH ROW
EXECUTE FUNCTION public.handle_vehicle_assessment_status();

-- 7. ENABLE REALTIME PUBLICATIONS (Ignore if already enabled)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_assessments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
