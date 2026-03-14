import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore, OrderStatus } from '@/store/useStore';
import { fetchOrders, updateOrderStatus, subscribeToOrders, DbOrder, DEMO_RESTAURANT_ID } from '@/lib/supabase-api';
import { LogOut, ChefHat, Clock, CheckCircle2, BellRing, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const statusColors: Record<OrderStatus, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
  SERVED: 'bg-success/10 text-success border-success/30',
};

const nextStatus: Record<OrderStatus, OrderStatus | null> = {
  NEW: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
  SERVED: null,
};

const KitchenDashboard = () => {
  const { logout } = useStore();
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const prevOrderCount = useRef(0);

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchOrders();
      setOrders(data);
      
      // Notification for new orders
      const newCount = data.filter((o) => o.status === 'NEW').length;
      if (newCount > prevOrderCount.current && prevOrderCount.current > 0) {
        toast.info(`🔔 New order received!`, { duration: 5000 });
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 800; gain.gain.value = 0.3;
          osc.start(); osc.stop(ctx.currentTime + 0.15);
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2); gain2.connect(ctx.destination);
            osc2.frequency.value = 1000; gain2.gain.value = 0.3;
            osc2.start(); osc2.stop(ctx.currentTime + 0.15);
          }, 180);
        } catch {}
      }
      prevOrderCount.current = newCount;
    } catch {}
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Real-time subscription
  useEffect(() => {
    const unsub = subscribeToOrders(DEMO_RESTAURANT_ID, loadOrders);
    return unsub;
  }, [loadOrders]);

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
    } catch {
      toast.error('Failed to update order status');
    }
  };

  const displayed = filter === 'ALL' ? orders : orders.filter((o) => o.status === filter);
  const counts: Record<string, number> = {
    NEW: orders.filter((o) => o.status === 'NEW').length,
    PREPARING: orders.filter((o) => o.status === 'PREPARING').length,
    READY: orders.filter((o) => o.status === 'READY').length,
    SERVED: orders.filter((o) => o.status === 'SERVED').length,
  };

  const getActionButton = (status: OrderStatus) => {
    switch (status) {
      case 'NEW': return { label: 'Start Preparing', icon: <ChefHat className="h-4 w-4 mr-1" /> };
      case 'PREPARING': return { label: 'Mark Ready', icon: <CheckCircle2 className="h-4 w-4 mr-1" /> };
      case 'READY': return { label: 'Mark Served', icon: <UtensilsCrossed className="h-4 w-4 mr-1" /> };
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Kitchen Dashboard</h1>
            {counts.NEW > 0 && (
              <span className="relative flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-5 w-5 bg-destructive text-destructive-foreground items-center justify-center text-xs font-bold">
                  {counts.NEW}
                </span>
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 grid grid-cols-4 gap-2 sm:gap-3">
        {(['NEW', 'PREPARING', 'READY', 'SERVED'] as OrderStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? 'ALL' : s)}
            className={`p-3 rounded-lg border text-center transition-colors ${filter === s ? statusColors[s] : 'bg-card'}`}
          >
            <div className="text-2xl font-bold">{counts[s]}</div>
            <div className="text-[10px] sm:text-xs font-medium">{s}</div>
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8 space-y-3">
        {displayed.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No orders yet</p>
          </div>
        )}
        {displayed.map((order) => {
          const action = getActionButton(order.status);
          return (
            <div
              key={order.id}
              className={`bg-card rounded-lg border p-4 animate-slide-up ${order.status === 'NEW' ? 'border-warning/50 shadow-md' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {order.status === 'NEW' && <BellRing className="h-4 w-4 text-warning animate-bounce" />}
                  <span className="font-bold">Table {order.table_number}</span>
                </div>
                <Badge variant="outline" className={statusColors[order.status]}>{order.status}</Badge>
              </div>
              <div className="space-y-1 mb-3">
                {order.items?.map((item) => (
                  <div key={item.id} className="text-sm flex justify-between">
                    <span>{item.name} × {item.quantity}</span>
                    <span className="text-muted-foreground">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="font-bold text-sm">Total: ₹{order.total_price}</span>
                {action && nextStatus[order.status] && (
                  <Button size="sm" onClick={() => handleStatusUpdate(order.id, nextStatus[order.status]!)}>
                    {action.icon} {action.label}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KitchenDashboard;
