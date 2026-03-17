
-- Feature 1: Add CANCELLED to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Add cancellation metadata columns to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS cancelled_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason text DEFAULT NULL;
