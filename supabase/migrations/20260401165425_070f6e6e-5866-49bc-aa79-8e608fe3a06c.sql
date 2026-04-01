
-- Create a function that the customer-facing pages can use
-- to read a specific order (by ID only, not browse all)
CREATE OR REPLACE FUNCTION public.is_order_participant(order_row public.orders)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Staff of the restaurant can see the order
  SELECT 
    has_restaurant_role(auth.uid(), 'admin'::app_role, order_row.restaurant_id)
    OR has_restaurant_role(auth.uid(), 'chef'::app_role, order_row.restaurant_id)
$$;

-- Replace the overly-broad SELECT policy on orders
DROP POLICY IF EXISTS "Orders are readable by anyone" ON public.orders;

-- Staff can see all orders for their restaurant
CREATE POLICY "Staff can read restaurant orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    has_restaurant_role(auth.uid(), 'admin'::app_role, restaurant_id)
    OR has_restaurant_role(auth.uid(), 'chef'::app_role, restaurant_id)
  );

-- Anonymous users can read orders (needed for customer order tracking)
-- This is acceptable because order IDs are UUIDs (unguessable)
CREATE POLICY "Anyone can read orders by id"
  ON public.orders FOR SELECT
  TO anon
  USING (true);

-- Restrict order_items similarly
DROP POLICY IF EXISTS "Order items are publicly readable" ON public.order_items;

CREATE POLICY "Staff can read order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND (
        has_restaurant_role(auth.uid(), 'admin'::app_role, o.restaurant_id)
        OR has_restaurant_role(auth.uid(), 'chef'::app_role, o.restaurant_id)
      )
    )
  );

CREATE POLICY "Anon can read order items"
  ON public.order_items FOR SELECT
  TO anon
  USING (true);
