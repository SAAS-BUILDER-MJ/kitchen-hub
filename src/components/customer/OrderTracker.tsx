import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Clock, ChefHat, CheckCircle2, UtensilsCrossed, ClipboardList, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DbOrder, subscribeToOrders, DEMO_RESTAURANT_ID } from '@/lib/supabase-api';

const ORDER_STORAGE_KEY = 'customer_order_ids';

/** Save an order ID to localStorage for tracking */
export function saveOrderForTracking(orderId: string) {
  const existing = getTrackedOrderIds();
  if (!existing.includes(orderId)) {
    existing.push(orderId);
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(existing));
  }
}

/** Get tracked order IDs from localStorage */
export function getTrackedOrderIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Remove served/old orders from localStorage */
function cleanupTrackedOrders(activeIds: string[]) {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(activeIds));
}

const statusIcons: Record<string, React.ReactNode> = {
  NEW: <Clock className="h-4 w-4" />,
  PREPARING: <ChefHat className="h-4 w-4" />,
  READY: <CheckCircle2 className="h-4 w-4" />,
  SERVED: <UtensilsCrossed className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
  SERVED: 'bg-success/10 text-success border-success/30',
};

interface OrderTrackerProps {
  tableNumber: number;
}

export default function OrderTracker({ tableNumber }: OrderTrackerProps) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadOrders = async () => {
    const ids = getTrackedOrderIds();
    if (ids.length === 0) {
      setOrders([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('id', ids)
        .neq('status', 'SERVED')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const activeOrders = (data || []).map((o: any) => ({
        ...o,
        items: o.order_items || [],
      })) as DbOrder[];

      setOrders(activeOrders);

      // Cleanup: remove served orders from localStorage
      const activeIds = activeOrders.map((o) => o.id);
      cleanupTrackedOrders(activeIds);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Real-time updates
  useEffect(() => {
    const unsub = subscribeToOrders(DEMO_RESTAURANT_ID, loadOrders);
    return unsub;
  }, []);

  const activeCount = orders.length;

  if (activeCount === 0 && !isOpen) return null;

  return (
    <>
      {/* Floating button */}
      {!isOpen && activeCount > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-4 z-40 bg-primary text-primary-foreground rounded-full px-4 py-3 shadow-lg flex items-center gap-2 animate-slide-up"
        >
          <ClipboardList className="h-5 w-5" />
          <span className="text-sm font-semibold">My Orders ({activeCount})</span>
        </button>
      )}

      {/* Order tracking panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-card border-t rounded-t-2xl overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                My Orders
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 space-y-3">
              {loading && <p className="text-center text-muted-foreground text-sm">Loading...</p>}
              {!loading && orders.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No active orders</p>
              )}
              {orders.map((order) => (
                <div key={order.id} className="bg-background rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">Table {order.table_number}</span>
                    <Badge variant="outline" className={`flex items-center gap-1 ${statusColors[order.status]}`}>
                      {statusIcons[order.status]}
                      {order.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {order.items?.map((item) => (
                      <div key={item.id} className="text-sm flex justify-between">
                        <span>{item.name} × {item.quantity}</span>
                        <span className="text-muted-foreground">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t mt-2 pt-2 flex items-center justify-between">
                    <span className="font-bold text-sm">₹{order.total_price}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsOpen(false);
                        navigate(`/order-status/${order.id}`);
                      }}
                    >
                      Track
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
