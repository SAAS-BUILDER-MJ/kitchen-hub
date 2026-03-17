
-- Feature 2: Add notes column to order_items for special instructions
ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;
