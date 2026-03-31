
-- Enable pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Recreate rotate_qr_code to use extensions.gen_random_bytes
CREATE OR REPLACE FUNCTION public.rotate_qr_code(_table_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE new_code TEXT;
BEGIN
  new_code := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE public.tables SET qr_code = new_code WHERE id = _table_id;
  RETURN new_code;
END;
$$;

-- Auto-generate QR code when a new table is inserted
CREATE OR REPLACE FUNCTION public.auto_generate_qr_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NEW.qr_code IS NULL THEN
    NEW.qr_code := encode(extensions.gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_qr_code
  BEFORE INSERT ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_qr_code();
