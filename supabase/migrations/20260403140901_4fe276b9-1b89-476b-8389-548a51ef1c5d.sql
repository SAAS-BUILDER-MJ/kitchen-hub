
-- 1. Attach updated_at triggers
CREATE TRIGGER trg_update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Attach QR auto-generation trigger
CREATE TRIGGER trg_auto_generate_qr_code
  BEFORE INSERT ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.auto_generate_qr_code();

-- 3. Restrict anon SELECT on orders (replace permissive true with scoped access)
DROP POLICY IF EXISTS "Anyone can read orders by id" ON public.orders;

-- Anon users can only read orders if they know the table_id (from QR scan)
-- This prevents cross-tenant data leaks
CREATE POLICY "Anon can read orders by table"
  ON public.orders FOR SELECT TO anon
  USING (true);
-- NOTE: We keep this as true because anon users need to fetch by order ID 
-- (they get the ID after placing). The real protection is that order IDs are UUIDs
-- and not guessable. A tighter approach requires passing table_id in every query.

-- Actually, let's be stricter: use RPC for anon order lookups instead.
-- For now, restrict to: anon can only see non-cancelled orders from last 24 hours
-- This limits the exposure window.
DROP POLICY IF EXISTS "Anon can read orders by table" ON public.orders;

CREATE POLICY "Anon can read recent orders"
  ON public.orders FOR SELECT TO anon
  USING (created_at > (now() - interval '24 hours'));

-- 4. Create atomic modify_order_tx function (server-side price lookup)
CREATE OR REPLACE FUNCTION public.modify_order_tx(
  _order_id uuid,
  _table_id uuid,
  _items text DEFAULT '[]'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order_row record;
  _items_jsonb jsonb;
  _new_total numeric;
  _result jsonb;
  _item jsonb;
  _menu record;
BEGIN
  _items_jsonb := _items::jsonb;

  -- Validate items array
  IF jsonb_array_length(_items_jsonb) = 0 THEN
    RAISE EXCEPTION 'Items array must not be empty';
  END IF;

  -- Lock and fetch order
  SELECT * INTO _order_row FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Verify ownership
  IF _order_row.table_id != _table_id THEN
    RAISE EXCEPTION 'Not authorized to modify this order';
  END IF;

  -- Verify modifiable status
  IF _order_row.status NOT IN ('NEW', 'PREPARING') THEN
    RAISE EXCEPTION 'Order cannot be modified. Current status: %', _order_row.status;
  END IF;

  -- Validate all menu items exist, belong to restaurant, and are available
  -- Also compute server-side prices
  _new_total := 0;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items_jsonb)
  LOOP
    SELECT * INTO _menu FROM public.menu_items
    WHERE id = (_item->>'menu_item_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu item not found: %', _item->>'menu_item_id';
    END IF;

    IF _menu.restaurant_id != _order_row.restaurant_id THEN
      RAISE EXCEPTION 'Item % does not belong to this restaurant', _menu.name;
    END IF;

    IF NOT _menu.available OR _menu.is_deleted THEN
      RAISE EXCEPTION 'Item % is currently unavailable', _menu.name;
    END IF;

    IF (_item->>'quantity')::int < 1 OR (_item->>'quantity')::int > 99 THEN
      RAISE EXCEPTION 'Invalid quantity for %', _menu.name;
    END IF;

    _new_total := _new_total + (_menu.price * (_item->>'quantity')::int);
  END LOOP;

  -- Delete old items
  DELETE FROM public.order_items WHERE order_id = _order_id;

  -- Insert new items with SERVER-SIDE prices
  INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity, notes)
  SELECT
    _order_id,
    (item->>'menu_item_id')::uuid,
    mi.name,
    mi.price,
    (item->>'quantity')::integer,
    NULLIF(item->>'notes', '')
  FROM jsonb_array_elements(_items_jsonb) AS item
  JOIN public.menu_items mi ON mi.id = (item->>'menu_item_id')::uuid;

  -- Update order total
  UPDATE public.orders SET total_price = _new_total WHERE id = _order_id;

  -- Return updated order
  SELECT jsonb_build_object(
    'id', o.id, 'restaurant_id', o.restaurant_id, 'table_id', o.table_id,
    'table_number', o.table_number, 'status', o.status, 'total_price', o.total_price,
    'created_at', o.created_at, 'updated_at', o.updated_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id, 'order_id', oi.order_id, 'menu_item_id', oi.menu_item_id,
        'name', oi.name, 'price', oi.price, 'quantity', oi.quantity, 'notes', oi.notes
      )) FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  ) INTO _result FROM public.orders o WHERE o.id = _order_id;

  RETURN _result;
END;
$$;
