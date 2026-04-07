
-- 1. Fix cross-tenant order status updates
-- Drop the old policy that allows non-scoped role checks
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;

-- Create a properly scoped policy - only staff with restaurant-specific roles can update
CREATE POLICY "Staff can update their restaurant orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  has_restaurant_role(auth.uid(), 'chef'::app_role, restaurant_id)
  OR has_restaurant_role(auth.uid(), 'admin'::app_role, restaurant_id)
);

-- 2. Fix cross-tenant admin role management
-- Drop the old policy that doesn't scope by restaurant_id
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Create restaurant-scoped admin role management
CREATE POLICY "Admins can manage roles in their restaurant"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_restaurant_role(auth.uid(), 'admin'::app_role, restaurant_id)
)
WITH CHECK (
  has_restaurant_role(auth.uid(), 'admin'::app_role, restaurant_id)
);
