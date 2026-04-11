-- 1. Add idempotency_key column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Update place_order_tx to store idempotency_key
CREATE OR REPLACE FUNCTION public.place_order_tx(
  _restaurant_id uuid,
  _table_id uuid,
  _table_number integer,
  _items jsonb,
  _idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order_id uuid;
  _total numeric := 0;
  _item jsonb;
  _menu_item record;
  _result jsonb;
BEGIN
  INSERT INTO public.orders (restaurant_id, table_id, table_number, status, total_price, idempotency_key)
  VALUES (_restaurant_id, _table_id, _table_number, 'NEW', 0, _idempotency_key)
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

  SELECT jsonb_build_object(
    'id', o.id, 'restaurant_id', o.restaurant_id, 'table_id', o.table_id,
    'table_number', o.table_number, 'status', o.status, 'total_price', _total,
    'created_at', o.created_at, 'updated_at', o.updated_at
  ) INTO _result FROM public.orders o WHERE o.id = _order_id;
  RETURN _result;
END;
$function$;

-- 3. Update modify_order_tx to accept and verify table_id
CREATE OR REPLACE FUNCTION public.modify_order_tx(
  _order_id uuid,
  _table_id uuid,
  _expected_updated_at timestamp with time zone,
  _items jsonb,
  _restaurant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order record;
  _total numeric := 0;
  _item jsonb;
  _menu_item record;
  _actual_restaurant_id uuid;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  -- Verify table_id matches (customer authorization)
  IF _order.table_id != _table_id THEN
    RAISE EXCEPTION 'Not authorized to modify this order';
  END IF;

  _actual_restaurant_id := _order.restaurant_id;

  -- If restaurant_id was provided, verify it matches
  IF _restaurant_id IS NOT NULL AND _order.restaurant_id != _restaurant_id THEN
    RAISE EXCEPTION 'Restaurant mismatch';
  END IF;

  IF _order.status NOT IN ('NEW', 'PREPARING') THEN
    RAISE EXCEPTION 'Order cannot be modified in % status', _order.status;
  END IF;

  IF _expected_updated_at IS NOT NULL AND _order.updated_at != _expected_updated_at THEN
    RAISE EXCEPTION 'Concurrency conflict';
  END IF;

  DELETE FROM public.order_items WHERE order_id = _order_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, name, price, available, is_deleted INTO _menu_item
    FROM public.menu_items WHERE id = (_item->>'menu_item_id')::uuid AND restaurant_id = _actual_restaurant_id;
    IF NOT FOUND OR _menu_item.is_deleted OR NOT _menu_item.available THEN
      RAISE EXCEPTION 'Menu item % not available', _item->>'menu_item_id';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, price, notes)
    VALUES (_order_id, _menu_item.id, _menu_item.name, (_item->>'quantity')::int, _menu_item.price, _item->>'notes');
    _total := _total + (_menu_item.price * (_item->>'quantity')::int);
  END LOOP;

  UPDATE public.orders SET total_price = _total WHERE id = _order_id;
  RETURN jsonb_build_object('id', _order_id, 'total_price', _total, 'status', _order.status, 'updated_at', now());
END;
$function$;