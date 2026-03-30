
-- Enums
CREATE TYPE public.order_status AS ENUM ('NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');
CREATE TYPE public.app_role AS ENUM ('admin', 'chef', 'user');

-- Restaurants
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Tables
CREATE TABLE public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  qr_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, table_number)
);
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Menu Categories
CREATE TABLE public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

-- Menu Items
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  emoji TEXT DEFAULT '🍽️',
  available BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX idx_menu_items_restaurant ON public.menu_items(restaurant_id);

-- Orders (with idempotency_key for duplicate prevention)
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  status public.order_status NOT NULL DEFAULT 'NEW',
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cancelled_by TEXT DEFAULT NULL,
  cancel_reason TEXT DEFAULT NULL,
  idempotency_key TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE UNIQUE INDEX idx_orders_idempotency_key ON public.orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Order Items
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- User Roles (separate table per security guidelines)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, restaurant_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions for role checks (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_restaurant_role(_user_id UUID, _role public.app_role, _restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role AND restaurant_id = _restaurant_id)
$$;

-- QR resolution function (security definer — no RLS bypass needed by customers)
CREATE OR REPLACE FUNCTION public.resolve_qr(_qr_code TEXT)
RETURNS TABLE(restaurant_id UUID, restaurant_name TEXT, table_id UUID, table_number INTEGER, is_active BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, t.id, t.table_number, t.is_active
  FROM public.tables t JOIN public.restaurants r ON r.id = t.restaurant_id
  WHERE t.qr_code = _qr_code
$$;

-- QR rotation function (admin only, called from edge functions)
CREATE OR REPLACE FUNCTION public.rotate_qr_code(_table_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_code TEXT;
BEGIN
  new_code := encode(gen_random_bytes(32), 'hex');
  UPDATE public.tables SET qr_code = new_code WHERE id = _table_id;
  RETURN new_code;
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Restaurants: publicly readable, admin can manage own
CREATE POLICY "Restaurants are publicly readable" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "Admins can manage restaurants" ON public.restaurants FOR ALL TO authenticated USING (public.has_restaurant_role(auth.uid(), 'admin', id));

-- Tables: publicly readable, admin can manage
CREATE POLICY "Tables are publicly readable" ON public.tables FOR SELECT USING (true);
CREATE POLICY "Admins can manage tables" ON public.tables FOR ALL TO authenticated USING (public.has_restaurant_role(auth.uid(), 'admin', restaurant_id));

-- Menu Categories: publicly readable, admin can manage
CREATE POLICY "Menu categories are publicly readable" ON public.menu_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.menu_categories FOR ALL TO authenticated USING (public.has_restaurant_role(auth.uid(), 'admin', restaurant_id));

-- Menu Items: publicly readable, admin can manage
CREATE POLICY "Menu items are publicly readable" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage menu items" ON public.menu_items FOR ALL TO authenticated USING (public.has_restaurant_role(auth.uid(), 'admin', restaurant_id));

-- Orders: anyone can create (verified by restaurant existence), anyone can read, staff can update
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id));
CREATE POLICY "Orders are readable by anyone" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'chef'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR
  has_restaurant_role(auth.uid(), 'chef'::app_role, restaurant_id) OR has_restaurant_role(auth.uid(), 'admin'::app_role, restaurant_id)
);

-- Order Items: insertable if order exists, publicly readable
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id));
CREATE POLICY "Order items are publicly readable" ON public.order_items FOR SELECT USING (true);

-- User Roles: users see own roles, admins can manage
CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
