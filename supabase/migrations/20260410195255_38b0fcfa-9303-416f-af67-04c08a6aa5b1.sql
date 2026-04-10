
-- ============================================
-- 1. Fix order_items SELECT RLS  
-- ============================================
DROP POLICY IF EXISTS "Order items are publicly readable" ON public.order_items;

CREATE POLICY "Staff can read restaurant order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND (
      has_restaurant_role(auth.uid(), 'chef'::app_role, o.restaurant_id)
      OR has_restaurant_role(auth.uid(), 'admin'::app_role, o.restaurant_id)
    )
  )
);

CREATE POLICY "Public can read order items by order"
ON public.order_items FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
  )
);

-- ============================================
-- 2. resolve_qr function
-- ============================================
CREATE OR REPLACE FUNCTION public.resolve_qr(_qr_code text)
RETURNS TABLE(table_id uuid, table_number int, restaurant_id uuid, restaurant_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.table_number, t.restaurant_id, r.name
  FROM public.tables t
  JOIN public.restaurants r ON r.id = t.restaurant_id
  WHERE t.qr_code = _qr_code AND t.is_active = true
  LIMIT 1;
$$;

-- ============================================
-- 3. rotate_qr_code function
-- ============================================
CREATE OR REPLACE FUNCTION public.rotate_qr_code(_table_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_code text;
  _restaurant_id uuid;
BEGIN
  SELECT restaurant_id INTO _restaurant_id FROM public.tables WHERE id = _table_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Table not found'; END IF;
  IF NOT has_restaurant_role(auth.uid(), 'admin'::app_role, _restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  new_code := encode(gen_random_bytes(32), 'hex');
  UPDATE public.tables SET qr_code = new_code WHERE id = _table_id;
  RETURN new_code;
END;
$$;

-- ============================================
-- 4. place_order_tx function
-- ============================================
CREATE OR REPLACE FUNCTION public.place_order_tx(
  _restaurant_id uuid, _table_id uuid, _table_number int, _items jsonb, _idempotency_key text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _order_id uuid; _total numeric := 0; _item jsonb; _menu_item record; _result jsonb;
BEGIN
  INSERT INTO public.orders (restaurant_id, table_id, table_number, status, total_price)
  VALUES (_restaurant_id, _table_id, _table_number, 'NEW', 0)
  RETURNING id INTO _order_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, name, price, available, is_deleted INTO _menu_item
    FROM public.menu_items WHERE id = (_item->>'menu_item_id')::uuid AND restaurant_id = _restaurant_id;
    IF NOT FOUND OR _menu_item.is_deleted OR NOT _menu_item.available THEN
      RAISE EXCEPTION 'Menu item % not available', _item->>'menu_item_id';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, price, notes)
    VALUES (_order_id, _menu_item.id, _menu_item.name, (_item->>'quantity')::int, _menu_item.price, _item->>'notes');
    _total := _total + (_menu_item.price * (_item->>'quantity')::int);
  END LOOP;

  UPDATE public.orders SET total_price = _total WHERE id = _order_id;
  SELECT jsonb_build_object('id', o.id, 'restaurant_id', o.restaurant_id, 'table_id', o.table_id,
    'table_number', o.table_number, 'status', o.status, 'total_price', _total, 'created_at', o.created_at
  ) INTO _result FROM public.orders o WHERE o.id = _order_id;
  RETURN _result;
END;
$$;

-- ============================================
-- 5. modify_order_tx function
-- ============================================
CREATE OR REPLACE FUNCTION public.modify_order_tx(
  _order_id uuid, _expected_updated_at timestamptz, _items jsonb, _restaurant_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _order record; _total numeric := 0; _item jsonb; _menu_item record;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _order.restaurant_id != _restaurant_id THEN RAISE EXCEPTION 'Restaurant mismatch'; END IF;
  IF _order.status NOT IN ('NEW', 'PREPARING') THEN RAISE EXCEPTION 'Order cannot be modified in % status', _order.status; END IF;
  IF _order.updated_at != _expected_updated_at THEN RAISE EXCEPTION 'Concurrency conflict'; END IF;

  DELETE FROM public.order_items WHERE order_id = _order_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, name, price, available, is_deleted INTO _menu_item
    FROM public.menu_items WHERE id = (_item->>'menu_item_id')::uuid AND restaurant_id = _restaurant_id;
    IF NOT FOUND OR _menu_item.is_deleted OR NOT _menu_item.available THEN
      RAISE EXCEPTION 'Menu item % not available', _item->>'menu_item_id';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, price, notes)
    VALUES (_order_id, _menu_item.id, _menu_item.name, (_item->>'quantity')::int, _menu_item.price, _item->>'notes');
    _total := _total + (_menu_item.price * (_item->>'quantity')::int);
  END LOOP;

  UPDATE public.orders SET total_price = _total WHERE id = _order_id;
  RETURN jsonb_build_object('id', _order_id, 'total_price', _total, 'status', _order.status);
END;
$$;
