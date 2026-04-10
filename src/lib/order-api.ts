import { supabase } from '@/integrations/supabase/client';

export type OrderStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

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

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

export async function placeOrder(
  restaurantId: string,
  tableId: string,
  _tableNumber: number,
  items: { menu_item_id: string; name: string; quantity: number; price: number; notes?: string | null }[],
  idempotencyKey?: string,
  qrToken?: string | null
) {
  const { data, error } = await supabase.functions.invoke('place-order', {
    body: {
      restaurant_id: restaurantId,
      table_id: tableId,
      qr_token: qrToken || null,
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
  restaurantId: string,
  options?: { from?: string; to?: string; limit?: number; offset?: number }
) {
  if (!restaurantId) throw new Error('restaurantId is required');
  let query = supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (options?.from) query = query.gte('created_at', options.from);
  if (options?.to) query = query.lte('created_at', options.to);

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
  if (error) {
    if (error.message?.includes('Invalid status transition') || error.message?.includes('Cannot change status')) {
      throw new Error(error.message);
    }
    throw error;
  }
}

export async function cancelOrder(
  orderId: string,
  cancelledBy: 'customer' | 'staff',
  reason?: string,
  tableId?: string
) {
  const { data, error } = await supabase.functions.invoke('cancel-order', {
    body: {
      order_id: orderId,
      cancelled_by: cancelledBy,
      reason: reason || null,
      table_id: tableId || null,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

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
