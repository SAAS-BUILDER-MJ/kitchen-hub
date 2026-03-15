
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders" ON public.orders
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'chef'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_restaurant_role(auth.uid(), 'chef'::app_role, restaurant_id)
  OR has_restaurant_role(auth.uid(), 'admin'::app_role, restaurant_id)
);
