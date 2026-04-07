
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE OLD.status
    WHEN 'NEW' THEN
      IF NEW.status NOT IN ('PREPARING', 'CANCELLED') THEN
        RAISE EXCEPTION 'Invalid status transition from NEW to %', NEW.status;
      END IF;
    WHEN 'PREPARING' THEN
      IF NEW.status NOT IN ('READY', 'CANCELLED') THEN
        RAISE EXCEPTION 'Invalid status transition from PREPARING to %', NEW.status;
      END IF;
    WHEN 'READY' THEN
      IF NEW.status NOT IN ('SERVED') THEN
        RAISE EXCEPTION 'Invalid status transition from READY to %', NEW.status;
      END IF;
    WHEN 'SERVED' THEN
      RAISE EXCEPTION 'Cannot change status of a served order';
    WHEN 'CANCELLED' THEN
      RAISE EXCEPTION 'Cannot change status of a cancelled order';
    ELSE
      RAISE EXCEPTION 'Unknown order status: %', OLD.status;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_order_status
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_status_transition();
