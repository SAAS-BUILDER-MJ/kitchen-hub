-- 1. Restaurant configuration table
CREATE TABLE IF NOT EXISTS public.restaurant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  currency_symbol text NOT NULL DEFAULT '₹',
  tax_rate numeric NOT NULL DEFAULT 0,
  business_hours_open time DEFAULT '09:00',
  business_hours_close time DEFAULT '22:00',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their restaurant config"
ON public.restaurant_config FOR ALL TO authenticated
USING (has_restaurant_role(auth.uid(), 'admin'::app_role, restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), 'admin'::app_role, restaurant_id));

CREATE POLICY "Config is publicly readable"
ON public.restaurant_config FOR SELECT TO public
USING (true);

CREATE TRIGGER update_restaurant_config_updated_at
BEFORE UPDATE ON public.restaurant_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Waiter policies
CREATE POLICY "Waiters can update their restaurant orders"
ON public.orders FOR UPDATE TO authenticated
USING (has_restaurant_role(auth.uid(), 'waiter'::app_role, restaurant_id));

CREATE POLICY "Waiters can read their restaurant orders"
ON public.orders FOR SELECT TO authenticated
USING (has_restaurant_role(auth.uid(), 'waiter'::app_role, restaurant_id));

CREATE POLICY "Waiters can read restaurant order items"
ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_items.order_id
  AND has_restaurant_role(auth.uid(), 'waiter'::app_role, o.restaurant_id)
));

-- 3. Menu images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Menu images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can upload menu images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can update menu images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can delete menu images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'menu-images');