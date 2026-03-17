
-- Feature 3: Soft delete for menu items
ALTER TABLE public.menu_items 
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;
