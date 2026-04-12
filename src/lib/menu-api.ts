import { supabase } from '@/integrations/supabase/client';

export interface DbMenuItem {
  id: string;
  category_id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  emoji: string | null;
  available: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  category_name?: string;
}

export async function fetchMenuItems(restaurantId: string) {
  if (!restaurantId) throw new Error('restaurantId is required');
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_categories!menu_items_category_id_fkey(name)')
    .eq('restaurant_id', restaurantId)
    .eq('is_deleted', false)
    .order('name');
  if (error) throw error;
  return (data || []).map((item: any) => ({
    ...item,
    category_name: item.menu_categories?.name || '',
  })) as DbMenuItem[];
}

export async function fetchAllMenuItems(restaurantId: string) {
  if (!restaurantId) throw new Error('restaurantId is required');
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_categories!menu_items_category_id_fkey(name)')
    .eq('restaurant_id', restaurantId)
    .order('name');
  if (error) throw error;
  return (data || []).map((item: any) => ({
    ...item,
    category_name: item.menu_categories?.name || '',
  })) as DbMenuItem[];
}

export async function fetchCategories(restaurantId: string) {
  if (!restaurantId) throw new Error('restaurantId is required');
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function createMenuItem(item: {
  name: string;
  description: string;
  price: number;
  emoji: string;
  category_id: string;
  restaurant_id: string;
  image_url?: string | null;
}) {
  if (!item.restaurant_id) throw new Error('restaurant_id is required');
  const { data, error } = await supabase
    .from('menu_items')
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMenuItem(id: string, updates: Partial<{
  name: string;
  description: string;
  price: number;
  emoji: string;
  available: boolean;
  category_id: string;
  is_deleted: boolean;
  deleted_at: string | null;
  image_url: string | null;
}>) {
  const { error } = await supabase
    .from('menu_items')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMenuItem(id: string) {
  const { error } = await supabase
    .from('menu_items')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
