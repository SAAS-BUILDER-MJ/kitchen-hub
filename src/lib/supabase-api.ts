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
    .select('*, menu_categories!menu_items_category_id_fkey(name)')
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

/** Generate a unique idempotency key for an order */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

/**
 * Place an order via the server-side edge function.
 * Server validates prices, table ownership, and restaurant match.
 * Client-sent prices/names are IGNORED — server uses DB values.
 */
export async function placeOrder(
  restaurantId: string,
  tableId: string,
  _tableNumber: number, // unused — server resolves from tableId
  items: { menu_item_id: string; name: string; quantity: number; price: number; notes?: string | null }[],
  idempotencyKey?: string
) {
  const { data, error } = await supabase.functions.invoke('place-order', {
    body: {
      restaurant_id: restaurantId,
      table_id: tableId,
      items: items.map((i) => ({
        menu_item_id: i.menu_item_id,
        quantity: i.quantity,
        notes: i.notes || null,
      })),
      idempotency_key: idempotencyKey || generateIdempotencyKey(),
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data.order as DbOrder;
}

export async function fetchOrders(
  restaurantId: string = DEMO_RESTAURANT_ID,
  options?: { from?: string; to?: string; limit?: number; offset?: number }
) {
  let query = supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (options?.from) {
    query = query.gte('created_at', options.from);
  }
  if (options?.to) {
    query = query.lte('created_at', options.to);
  }

  const limit = options?.limit || 200;
  const offset = options?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
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

/** Cancel an order via server-side edge function (enforces grace period + permissions) */
export async function cancelOrder(orderId: string, cancelledBy: 'customer' | 'staff', reason?: string) {
  const { data, error } = await supabase.functions.invoke('cancel-order', {
    body: {
      order_id: orderId,
      cancelled_by: cancelledBy,
      reason: reason || null,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
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
