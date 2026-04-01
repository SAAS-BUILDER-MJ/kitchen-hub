
-- 1. FIX ORDERS UPDATE RLS — restaurant-scoped only
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders (scoped)" ON public.orders;

CREATE POLICY "Staff can update orders (scoped)"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    has_restaurant_role(auth.uid(), 'chef'::app_role, restaurant_id)
    OR has_restaurant_role(auth.uid(), 'admin'::app_role, restaurant_id)
  );

-- 2. ORDER STATUS TRANSITION VALIDATION TRIGGER
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = 'NEW' AND NEW.status IN ('PREPARING', 'CANCELLED') THEN RETURN NEW; END IF;
  IF OLD.status = 'PREPARING' AND NEW.status IN ('READY', 'CANCELLED') THEN RETURN NEW; END IF;
  IF OLD.status = 'READY' AND NEW.status = 'SERVED' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_status ON public.orders;
CREATE TRIGGER trg_validate_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();

-- 3. LOCK DOWN DIRECT INSERT (force edge function)
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

-- 4. UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
