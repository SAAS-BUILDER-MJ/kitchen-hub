-- Add waiter to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'waiter';

-- Orders updated_at trigger (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at') THEN
    CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;