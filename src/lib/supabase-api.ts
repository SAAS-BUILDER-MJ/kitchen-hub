import { supabase } from '@/integrations/supabase/client';

// Demo restaurant ID (seeded)
export const DEMO_RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';

export type OrderStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

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

export interface DbOrder {
  id: string;
  restaurant_id: string;
  table_id: string;
  table_number: number;
  status: OrderStatus;
  total_price: number;
  created_at: string;
  updated_at: string;
  cancelled_by: string | null;
  cancel_reason: string | null;
  items?: DbOrderItem[];
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  notes: string | null;
}

// ---- Menu ----
export async function fetchMenuItems(restaurantId: string = DEMO_RESTAURANT_ID) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_categories(name)')
    .eq('restaurant_id', restaurantId)
    .eq('is_deleted', false)
    .order('name');
  if (error) throw error;
  return (data || []).map((item: any) => ({
    ...item,
    category_name: item.menu_categories?.name || '',
  })) as DbMenuItem[];
}

/** Fetch ALL menu items including soft-deleted (for admin/analytics) */
export async function fetchAllMenuItems(restaurantId: string = DEMO_RESTAURANT_ID) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_categories(name)')
    .eq('restaurant_id', restaurantId)
    .order('name');
  if (error) throw error;
  return (data || []).map((item: any) => ({
    ...item,
    category_name: item.menu_categories?.name || '',
  })) as DbMenuItem[];
}

export async function fetchCategories(restaurantId: string = DEMO_RESTAURANT_ID) {
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
  restaurant_id?: string;
}) {
  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      ...item,
      restaurant_id: item.restaurant_id || DEMO_RESTAURANT_ID,
    })
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
}>) {
  const { error } = await supabase
    .from('menu_items')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMenuItem(id: string) {
  // Soft delete instead of hard delete
  const { error } = await supabase
    .from('menu_items')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ---- Tables ----
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

// ---- Orders ----
export async function placeOrder(
  restaurantId: string,
  tableId: string,
  tableNumber: number,
  items: { menu_item_id: string; name: string; quantity: number; price: number; notes?: string | null }[]
) {
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      table_number: tableNumber,
      total_price: totalPrice,
    })
    .select()
    .single();
  if (orderError) throw orderError;

  const orderItems = items.map((i) => ({
    order_id: order.id,
    menu_item_id: i.menu_item_id,
    name: i.name,
    quantity: i.quantity,
    price: i.price,
    notes: i.notes || null,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);
  if (itemsError) throw itemsError;

  return order;
}

export async function fetchOrders(restaurantId: string = DEMO_RESTAURANT_ID) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((o: any) => ({
    ...o,
    items: o.order_items || [],
  })) as DbOrder[];
}

export async function fetchOrder(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return { ...data, items: (data as any).order_items || [] } as DbOrder;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);
  if (error) throw error;
}

/** Cancel an order — customer (grace period) or staff (with reason) */
export async function cancelOrder(orderId: string, cancelledBy: 'customer' | 'staff', reason?: string) {
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'CANCELLED' as any,
      cancelled_by: cancelledBy,
      cancel_reason: reason || null,
    })
    .eq('id', orderId);
  if (error) throw error;
}

// ---- Realtime ----
export function subscribeToOrders(restaurantId: string, callback: () => void) {
  const channel = supabase
    .channel('orders-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
      () => callback()
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeToOrder(orderId: string, callback: () => void) {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      () => callback()
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
