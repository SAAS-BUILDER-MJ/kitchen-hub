
-- Fix #11: Prevent race condition in restaurant signup
-- Add unique constraint: one admin role per user (prevents duplicate restaurant creation)
CREATE UNIQUE INDEX idx_user_roles_one_admin_per_user 
ON public.user_roles (user_id) 
WHERE role = 'admin';

-- Fix #8: Ensure updated_at trigger exists on orders table
-- (create if not exists pattern)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at'
  ) THEN
    CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;
