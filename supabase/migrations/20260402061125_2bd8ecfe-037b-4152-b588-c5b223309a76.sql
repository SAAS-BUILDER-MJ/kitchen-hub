
-- Drop duplicate FKs (keep the original named ones)
ALTER TABLE public.menu_categories DROP CONSTRAINT IF EXISTS fk_menu_categories_restaurant;
ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS fk_menu_items_category;
ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS fk_menu_items_restaurant;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_restaurant;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_table;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order_items_order;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order_items_menu_item;
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS fk_tables_restaurant;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS fk_user_roles_restaurant;
