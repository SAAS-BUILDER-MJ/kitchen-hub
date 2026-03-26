-- Add index on tables.qr_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_tables_qr_code ON public.tables(qr_code);

-- RPC function: resolve a QR code to restaurant + table info
CREATE OR REPLACE FUNCTION public.resolve_qr(_qr_code TEXT)
RETURNS TABLE(
  restaurant_id UUID,
  restaurant_name TEXT,
  table_id UUID,
  table_number INTEGER,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS restaurant_id,
    r.name AS restaurant_name,
    t.id AS table_id,
    t.table_number,
    t.is_active
  FROM public.tables t
  JOIN public.restaurants r ON r.id = t.restaurant_id
  WHERE t.qr_code = _qr_code
  LIMIT 1;
$$;

-- Function to generate/rotate a QR code for a table
CREATE OR REPLACE FUNCTION public.rotate_qr_code(_table_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
BEGIN
  new_code := encode(gen_random_bytes(16), 'hex');
  UPDATE public.tables SET qr_code = new_code WHERE id = _table_id;
  RETURN new_code;
END;
$$;