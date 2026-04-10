import { supabase } from '@/integrations/supabase/client';

export async function fetchTable(restaurantId: string, tableNumber: number) {
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('table_number', tableNumber)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTables(restaurantId: string) {
  if (!restaurantId) throw new Error('restaurantId is required');
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('table_number');
  if (error) throw error;
  return data || [];
}
