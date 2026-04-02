
CREATE OR REPLACE FUNCTION public.place_order_tx(
  _restaurant_id uuid,
  _table_id uuid,
  _table_number integer,
  _total_price numeric,
  _idempotency_key text DEFAULT NULL,
  _items text DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order_id uuid;
  _order_row jsonb;
  _items_jsonb jsonb;
  _existing_id uuid;
BEGIN
  _items_jsonb := _items::jsonb;

  -- Check for existing order with same idempotency key
  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO _existing_id FROM public.orders WHERE idempotency_key = _idempotency_key;
    IF _existing_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'id', o.id, 'restaurant_id', o.restaurant_id, 'table_id', o.table_id,
        'table_number', o.table_number, 'status', o.status, 'total_price', o.total_price,
        'created_at', o.created_at, 'updated_at', o.updated_at, 'idempotency_key', o.idempotency_key,
        'duplicate', true,
        'items', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', oi.id, 'order_id', oi.order_id, 'menu_item_id', oi.menu_item_id,
            'name', oi.name, 'price', oi.price, 'quantity', oi.quantity, 'notes', oi.notes
          )) FROM public.order_items oi WHERE oi.order_id = o.id
        ), '[]'::jsonb)
      ) INTO _order_row FROM public.orders o WHERE o.id = _existing_id;
      RETURN _order_row;
    END IF;
  END IF;

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
  FROM jsonb_array_elements(_items_jsonb) AS item;

  SELECT jsonb_build_object(
    'id', o.id, 'restaurant_id', o.restaurant_id, 'table_id', o.table_id,
    'table_number', o.table_number, 'status', o.status, 'total_price', o.total_price,
    'created_at', o.created_at, 'updated_at', o.updated_at, 'idempotency_key', o.idempotency_key,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id, 'order_id', oi.order_id, 'menu_item_id', oi.menu_item_id,
        'name', oi.name, 'price', oi.price, 'quantity', oi.quantity, 'notes', oi.notes
      )) FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  ) INTO _order_row FROM public.orders o WHERE o.id = _order_id;

  RETURN _order_row;
END;
$$;
