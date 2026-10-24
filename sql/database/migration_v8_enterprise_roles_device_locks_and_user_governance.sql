-- ============================================================================
-- JRR TRANSPORT SYSTEM — MIGRATION V8:
-- ENTERPRISE ROLES, DRIVER DEVICE EMBEDDING LOCK & USER GOVERNANCE
-- Run this script in your Supabase SQL Editor.
-- ============================================================================

-- 1. EXPAND USER ROLES & APPROVAL COLUMNS IN PUBLIC.USERS
DO $$
BEGIN
  -- Drop existing role constraint if present
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
  
  -- Add updated role check supporting full logistics ecosystem roles
  ALTER TABLE public.users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('super_admin', 'admin', 'operations_admin', 'dispatcher', 'rental_manager', 'billing_clerk', 'driver', 'user'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Add User Governance & Approval Lifecycle Columns
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

-- Ensure super_admin and existing system accounts are approved by default
UPDATE public.users 
SET status = 'approved', is_approved = true, email_verified = true 
WHERE role IN ('super_admin', 'admin') AND status = 'pending';

-- 2. DRIVER PHONE EMBEDDING & 1-DEVICE LOCK ON PUBLIC.EMPLOYEES
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS bound_device_id TEXT,
  ADD COLUMN IF NOT EXISTS bound_device_model TEXT,
  ADD COLUMN IF NOT EXISTS bound_device_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_lock_enabled BOOLEAN DEFAULT true;

-- 3. DRIVER DEVICE TRANSFER / CHANGE REQUESTS TABLE
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
CREATE INDEX IF NOT EXISTS idx_driver_device_req_driver ON public.driver_device_requests(driver_id);

GRANT ALL ON TABLE public.driver_device_requests TO postgres, service_role, authenticated, anon;
ALTER TABLE public.driver_device_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for driver_device_requests" ON public.driver_device_requests;
CREATE POLICY "Allow all for driver_device_requests" ON public.driver_device_requests FOR ALL USING (true) WITH CHECK (true);

-- 4. AUTOMATED TRIGGER: BIND DEVICE TO DRIVER ON APPROVAL
CREATE OR REPLACE FUNCTION public.apply_driver_device_lock()
RETURNS TRIGGER AS $$
BEGIN
  -- If request transitioned to 'approved', automatically update driver's active device
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

-- 5. HELPER STORED PROCEDURES FOR ADMIN & SUPER ADMIN

-- Helper: Admin Approves a New User with specific role
CREATE OR REPLACE FUNCTION public.admin_approve_user(
  target_user_id UUID,
  assigned_role TEXT,
  admin_identity TEXT DEFAULT 'admin'
)
RETURNS JSONB AS $$
DECLARE
  updated_user RECORD;
BEGIN
  UPDATE public.users
  SET status = 'approved',
      is_approved = true,
      email_verified = true,
      role = assigned_role,
      approved_by = admin_identity,
      approved_at = NOW(),
      rejection_reason = NULL
  WHERE id = target_user_id
  RETURNING id, email, full_name, role, status INTO updated_user;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', updated_user.id,
    'email', updated_user.email,
    'role', updated_user.role,
    'status', updated_user.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Admin Rejects a User
CREATE OR REPLACE FUNCTION public.admin_reject_user(
  target_user_id UUID,
  reason_text TEXT DEFAULT 'Registration request denied by administration',
  admin_identity TEXT DEFAULT 'admin'
)
RETURNS JSONB AS $$
DECLARE
  updated_user RECORD;
BEGIN
  UPDATE public.users
  SET status = 'rejected',
      is_approved = false,
      rejection_reason = reason_text,
      approved_by = admin_identity,
      approved_at = NOW()
  WHERE id = target_user_id
  RETURNING id, email, status INTO updated_user;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', updated_user.id,
    'email', updated_user.email,
    'status', updated_user.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. REALTIME BROADCASTING
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_device_requests;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 7. NOTIFY SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
