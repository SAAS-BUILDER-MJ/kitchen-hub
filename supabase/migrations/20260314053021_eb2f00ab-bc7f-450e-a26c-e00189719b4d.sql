
-- Fix permissive INSERT policies by adding restaurant_id existence check
DROP POLICY "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id)
  );

DROP POLICY "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id)
  );
