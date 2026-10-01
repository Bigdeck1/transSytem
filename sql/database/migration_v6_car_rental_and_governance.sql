-- ============================================================================
-- JRR TRANSPORT SYSTEM — MIGRATION V6: CAR RENTAL & SYSTEM GOVERNANCE
-- Copy and run this script in your Supabase SQL Editor.
-- ============================================================================

-- 1. EXTEND VEHICLES TABLE WITH CAR RENTAL SPECIFICATIONS
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS rental_rate_per_day NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS security_deposit_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Standard' CHECK (category IN ('Sedan', 'SUV', 'Van', 'Pickup', 'Truck', 'Luxury', 'Standard')),
ADD COLUMN IF NOT EXISTS transmission TEXT DEFAULT 'Automatic' CHECK (transmission IN ('Automatic', 'Manual')),
ADD COLUMN IF NOT EXISTS seating_capacity INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'Gasoline' CHECK (fuel_type IN ('Gasoline', 'Diesel', 'Hybrid', 'Electric')),
ADD COLUMN IF NOT EXISTS operational_mode TEXT DEFAULT 'dual' CHECK (operational_mode IN ('hauling', 'rental', 'dual'));

-- 2. CAR RENTAL AGREEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.rental_agreements (
  id BIGSERIAL PRIMARY KEY,
  agreement_number TEXT NOT NULL UNIQUE,
  client_id INTEGER REFERENCES public.clients(id) ON DELETE RESTRICT,
  vehicle_id BIGINT NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL, -- Optional chauffeur driver
  rental_type TEXT NOT NULL DEFAULT 'self_drive' CHECK (rental_type IN ('self_drive', 'with_driver')),
  start_datetime TIMESTAMPTZ NOT NULL,
  expected_return_datetime TIMESTAMPTZ NOT NULL,
  actual_return_datetime TIMESTAMPTZ,
  daily_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_days INTEGER NOT NULL DEFAULT 1,
  base_rental_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  security_deposit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  additional_charges NUMERIC(12, 2) DEFAULT 0.00,
  late_fee NUMERIC(12, 2) DEFAULT 0.00,
  fuel_fee NUMERIC(12, 2) DEFAULT 0.00,
  damage_fee NUMERIC(12, 2) DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Deposit Paid', 'Fully Paid', 'Refunded')),
  rental_status TEXT NOT NULL DEFAULT 'Reserved' CHECK (rental_status IN ('Pending', 'Reserved', 'Active', 'Returned', 'Completed', 'Cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON TABLE public.rental_agreements TO postgres, service_role, authenticated, anon;
ALTER TABLE public.rental_agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for rental_agreements" ON public.rental_agreements;
CREATE POLICY "Allow all for rental_agreements" ON public.rental_agreements FOR ALL USING (true) WITH CHECK (true);

-- 3. CAR RENTAL VEHICLE INSPECTIONS TABLE (CHECKOUT / RETURN)
CREATE TABLE IF NOT EXISTS public.rental_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id BIGINT NOT NULL REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('checkout', 'return')),
  odometer_reading NUMERIC(10, 1) NOT NULL,
  fuel_level_percentage INTEGER NOT NULL CHECK (fuel_level_percentage BETWEEN 0 AND 100),
  body_condition_notes TEXT,
  existing_damage_photos JSONB DEFAULT '[]'::jsonb,
  inspector_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  customer_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON TABLE public.rental_inspections TO postgres, service_role, authenticated, anon;
ALTER TABLE public.rental_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for rental_inspections" ON public.rental_inspections;
CREATE POLICY "Allow all for rental_inspections" ON public.rental_inspections FOR ALL USING (true) WITH CHECK (true);

-- 4. SYSTEM AUDIT LOGS TABLE FOR GOVERNANCE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  username TEXT NOT NULL DEFAULT 'System',
  user_role TEXT DEFAULT 'admin',
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON TABLE public.audit_logs TO postgres, service_role, authenticated, anon;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for audit_logs" ON public.audit_logs;
CREATE POLICY "Allow all for audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- 5. LINK INVOICES TO RENTAL AGREEMENTS AS WELL AS TRIPS
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS rental_agreement_id BIGINT REFERENCES public.rental_agreements(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'hauling' CHECK (invoice_type IN ('hauling', 'rental'));

-- 6. ENABLE SUPABASE REALTIME ON RENTAL TABLES
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rental_agreements;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 7. NOTIFY SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
