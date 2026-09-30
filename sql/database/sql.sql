-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.attendance (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  employee_id uuid NOT NULL,
  date date NOT NULL,
  check_in time without time zone NOT NULL,
  check_out time without time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.clients (
  id integer NOT NULL DEFAULT nextval('clients_id_seq'::regclass),
  name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  phone character varying,
  address character varying,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  client_type character varying NOT NULL DEFAULT 'individual'::character varying,
  company_name character varying DEFAULT ''::character varying,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id text NOT NULL UNIQUE CHECK (length(employee_id) >= 4),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  position text NOT NULL,
  department text NOT NULL,
  status text NOT NULL,
  hire_date date NOT NULL,
  salary numeric,
  created_at timestamp without time zone DEFAULT now(),
  supabase_user_id uuid UNIQUE,
  daily_rate numeric NOT NULL DEFAULT 0,
  avatar_url text, -- New Column
  employee_pin4 text GENERATED ALWAYS AS (right(employee_id, 4)) STORED,
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);
CREATE TABLE public.invoices (
  id bigint NOT NULL DEFAULT nextval('invoices_id_seq'::regclass),
  invoice_number text NOT NULL UNIQUE,
  client_id integer,
  driver_id uuid,
  vehicle_id integer,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  program text,
  plate text,
  area text,
  hours integer,
  sro text,
  vtt text,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'Pending'::text,
  description text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT invoices_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.employees(id),
  CONSTRAINT invoices_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id)
);
CREATE TABLE public.time_off_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid,
  request_type character varying NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status character varying DEFAULT 'pending'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT time_off_requests_pkey PRIMARY KEY (id),
  CONSTRAINT time_off_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.trips (
  id bigint NOT NULL DEFAULT nextval('trips_id_seq'::regclass),
  trip_number text NOT NULL UNIQUE,
  driver_id uuid,
  vehicle_id integer,
  customer_number text,
  pickup_location text NOT NULL,
  pickup_time timestamp without time zone NOT NULL,
  delivery_location text NOT NULL,
  delivery_time timestamp without time zone NOT NULL,
  cargo text NOT NULL,
  status character varying DEFAULT 'scheduled'::character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  client_id integer,
  trip_type text NOT NULL DEFAULT 'cargo'::text,
  details jsonb,
  CONSTRAINT trips_pkey PRIMARY KEY (id),
  CONSTRAINT trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.employees(id),
  CONSTRAINT trips_vehicle_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id),
  CONSTRAINT trips_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  firstname text NOT NULL,
  lastname text NOT NULL,
  phone text,
  email_verified boolean DEFAULT false,
  account_status text DEFAULT 'pending' CHECK (account_status IN ('pending', 'approved', 'rejected')),
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.vehicles (
  id bigint NOT NULL DEFAULT nextval('vehicles_id_seq'::regclass),
  vehicle_number text NOT NULL,
  plate text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  vehicle_type text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['available'::text, 'in-use'::text, 'maintenance'::text, 'retired'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vehicles_pkey PRIMARY KEY (id)
);

-- Real Data Support for Mobile App
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  is_read boolean DEFAULT false,
  urgency text DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'urgent', 'alarm')),
  target_role text DEFAULT 'driver' CHECK (target_role IN ('driver', 'admin', 'all')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

CREATE TABLE public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  platform text CHECK (platform IN ('ios', 'android', 'web')),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.driver_locations (
  driver_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  vehicle_id integer REFERENCES public.vehicles(id) ON DELETE SET NULL,
  trip_id bigint REFERENCES public.trips(id) ON DELETE SET NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  speed numeric DEFAULT 0,
  heading numeric DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.vehicle_assessments (
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

CREATE TABLE public.paychecks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  gross_pay numeric NOT NULL,
  deductions numeric NOT NULL,
  net_pay numeric NOT NULL,
  hours_worked numeric NOT NULL,
  status text DEFAULT 'pending',
  payment_date date,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT paychecks_pkey PRIMARY KEY (id),
  CONSTRAINT paychecks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

CREATE TABLE public.trip_expenses (
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

CREATE TABLE public.incident_reports (
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

-- RPC for Attendance
CREATE OR REPLACE FUNCTION public.insert_attendance(p_employee_id uuid, p_today_time time DEFAULT CURRENT_TIME)
RETURNS public.attendance AS $$
DECLARE
    v_row public.attendance;
BEGIN
    INSERT INTO public.attendance (employee_id, date, check_in)
    VALUES (p_employee_id, CURRENT_DATE, p_today_time)
    RETURNING * INTO v_row;
    
    RETURN v_row;
END;
$$ LANGUAGE plpgsql;



