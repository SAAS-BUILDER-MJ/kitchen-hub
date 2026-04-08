import { supabase } from '@/integrations/supabase/client';
import { DbOrder } from './supabase-api';

type RealtimeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any>;
  old: Record<string, any>;
}) => void;

interface SubscriptionOptions {
  onStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
}

/**
 * Subscribe to orders with reconnection logic and connection status tracking.
 * Returns an unsubscribe function.
 */
export function subscribeToOrdersWithReconnect(
  restaurantId: string,
  callback: RealtimeCallback,
  options?: SubscriptionOptions
) {
  if (!restaurantId) return () => {};

  const channelName = `orders-rt-${restaurantId}-${Date.now()}`;
  let isSubscribed = true;

  const channel = supabase
    .channel(channelName, {
      config: { presence: { key: restaurantId } },
    })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => {
        if (!isSubscribed) return;
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: (payload.new || {}) as Record<string, any>,
          old: (payload.old || {}) as Record<string, any>,
        });
      }
    )
    .subscribe((status) => {
      if (!isSubscribed) return;
      if (status === 'SUBSCRIBED') {
        options?.onStatusChange?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        options?.onStatusChange?.('reconnecting');
        // Supabase client auto-reconnects; we just track status
      } else if (status === 'CLOSED') {
        options?.onStatusChange?.('disconnected');
      }
    });

  return () => {
    isSubscribed = false;
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to a single order with reconnection.
 */
export function subscribeToOrderWithReconnect(
  orderId: string,
  callback: (order: Record<string, any>) => void,
  options?: SubscriptionOptions
) {
  if (!orderId) return () => {};

  let isSubscribed = true;
  const channelName = `order-${orderId}-${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        if (!isSubscribed) return;
        callback(payload.new as Record<string, any>);
      }
    )
    .subscribe((status) => {
      if (!isSubscribed) return;
      if (status === 'SUBSCRIBED') {
        options?.onStatusChange?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        options?.onStatusChange?.('reconnecting');
      }
    });

  return () => {
    isSubscribed = false;
    supabase.removeChannel(channel);
  };
}
