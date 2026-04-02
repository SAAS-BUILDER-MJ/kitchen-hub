
-- Drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
DROP TRIGGER IF EXISTS update_menu_items_updated_at ON public.menu_items;
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON public.restaurants;
DROP TRIGGER IF EXISTS trg_validate_order_status ON public.orders;

-- Recreate triggers
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_validate_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();

-- Foreign keys (use IF NOT EXISTS pattern via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_menu_categories_restaurant') THEN
    ALTER TABLE public.menu_categories ADD CONSTRAINT fk_menu_categories_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_menu_items_category') THEN
    ALTER TABLE public.menu_items ADD CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_menu_items_restaurant') THEN
    ALTER TABLE public.menu_items ADD CONSTRAINT fk_menu_items_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_restaurant') THEN
    ALTER TABLE public.orders ADD CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_table') THEN
    ALTER TABLE public.orders ADD CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_order') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_menu_item') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT fk_order_items_menu_item FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tables_restaurant') THEN
    ALTER TABLE public.tables ADD CONSTRAINT fk_tables_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_roles_restaurant') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT fk_user_roles_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Transactional place order function
CREATE OR REPLACE FUNCTION public.place_order_tx(
  _restaurant_id uuid,
  _table_id uuid,
  _table_number integer,
  _total_price numeric,
  _idempotency_key text DEFAULT NULL,
  _items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order_id uuid;
  _order_row jsonb;
BEGIN
  INSERT INTO public.orders (restaurant_id, table_id, table_number, total_price, idempotency_key)
  VALUES (_restaurant_id, _table_id, _table_number, _total_price, _idempotency_key)
  RETURNING id INTO _order_id;

  INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity, notes)
  SELECT
    _order_id,
    (item->>'menu_item_id')::uuid,
    item->>'name',
    (item->>'price')::numeric,
    (item->>'quantity')::integer,
    NULLIF(item->>'notes', '')
  FROM jsonb_array_elements(_items) AS item;

  SELECT jsonb_build_object(
    'id', o.id,
    'restaurant_id', o.restaurant_id,
    'table_id', o.table_id,
    'table_number', o.table_number,
    'status', o.status,
    'total_price', o.total_price,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'idempotency_key', o.idempotency_key,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id, 'order_id', oi.order_id, 'menu_item_id', oi.menu_item_id,
        'name', oi.name, 'price', oi.price, 'quantity', oi.quantity, 'notes', oi.notes
      )) FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  ) INTO _order_row
  FROM public.orders o WHERE o.id = _order_id;

  RETURN _order_row;
END;
$$;
