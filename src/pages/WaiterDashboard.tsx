import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore, OrderStatus } from '@/store/useStore';
import { fetchOrders, updateOrderStatus, DbOrder } from '@/lib/supabase-api';
import { subscribeToOrdersWithReconnect } from '@/lib/realtime';
import { LogOut, UtensilsCrossed, Clock, CheckCircle2, WifiOff, Wifi, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
  SERVED: 'bg-success/10 text-success border-success/30',
};

const WaiterDashboard = () => {
  const { logout, auth } = useStore();
  const restaurantId = auth.userRestaurantId || '';
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'READY' | 'ALL'>('READY');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');

  const loadOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await fetchOrders(restaurantId);
      setOrders(data);
    } catch {} finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToOrdersWithReconnect(
      restaurantId,
      (payload) => {
        if (payload.eventType === 'INSERT') {
          import('@/lib/supabase-api').then(({ fetchOrder }) => {
            fetchOrder((payload.new as any).id).then((fullOrder) => {
              setOrders((prev) => prev.some((o) => o.id === fullOrder.id) ? prev : [fullOrder, ...prev]);
            }).catch(() => loadOrders());
          });
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any;
          setOrders((prev) => {
            const idx = prev.findIndex((o) => o.id === updated.id);
            if (idx === -1) { loadOrders(); return prev; }
            const next = [...prev];
            next[idx] = { ...prev[idx], ...updated, items: prev[idx].items };
            return next;
          });
          if (updated.status === 'READY') {
            toast.info(`🔔 Order for Table ${updated.table_number} is READY!`, { duration: 8000 });
            // Play sound
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.value = 880; gain.gain.value = 0.3;
              osc.start(); osc.stop(ctx.currentTime + 0.2);
            } catch {}
          }
        }
      },
      {
        onStatusChange: (status) => {
          setConnectionStatus(status);
          if (status === 'connected') loadOrders();
          if (status === 'disconnected') toast.error('Connection lost', { id: 'rt-status', duration: Infinity });
          if (status === 'reconnecting') toast.loading('Reconnecting...', { id: 'rt-status' });
          if (status === 'connected') toast.dismiss('rt-status');
        },
      }
    );
    return unsub;
  }, [restaurantId, loadOrders]);

  const activeOrders = useMemo(() =>
    orders
      .filter((o) => ['NEW', 'PREPARING', 'READY'].includes(o.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  );

  const displayed = useMemo(() =>
    filter === 'ALL' ? activeOrders : activeOrders.filter((o) => o.status === filter),
    [activeOrders, filter]
  );

  const readyCount = activeOrders.filter((o) => o.status === 'READY').length;

  const handleMarkServed = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'SERVED');
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'SERVED' as OrderStatus } : o));
      toast.success('Order marked as served ✓');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update order');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {connectionStatus !== 'connected' && (
        <div className={`sticky top-0 z-50 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 ${
          connectionStatus === 'disconnected' ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'
        }`}>
          {connectionStatus === 'disconnected' ? <><WifiOff className="h-4 w-4" /> Offline</> : <><Wifi className="h-4 w-4 animate-pulse" /> Reconnecting...</>}
        </div>
      )}

      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3" style={{ top: connectionStatus !== 'connected' ? '36px' : '0' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Waiter</h1>
            {readyCount > 0 && (
              <span className="relative flex h-6 w-6">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-6 w-6 bg-accent text-accent-foreground items-center justify-center text-xs font-bold">
                  {readyCount}
                </span>
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex gap-2 mb-4">
          <Button size="sm" variant={filter === 'READY' ? 'default' : 'secondary'} onClick={() => setFilter('READY')} className="gap-1">
            <Bell className="h-3.5 w-3.5" /> Ready to Serve ({readyCount})
          </Button>
          <Button size="sm" variant={filter === 'ALL' ? 'default' : 'secondary'} onClick={() => setFilter('ALL')} className="gap-1">
            All Active ({activeOrders.length})
          </Button>
        </div>

        {displayed.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{filter === 'READY' ? 'No orders ready for serving' : 'No active orders'}</p>
          </div>
        )}

        <div className="space-y-3">
          {displayed.map((order) => (
            <div
              key={order.id}
              className={`bg-card rounded-xl border p-4 transition-all ${
                order.status === 'READY' ? 'border-accent shadow-md ring-1 ring-accent/30' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">T{order.table_number}</span>
                  <Badge variant="outline" className={statusColors[order.status]}>{order.status}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
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
                <span className="font-bold text-sm">₹{order.total_price}</span>
                {order.status === 'READY' && (
                  <Button size="sm" onClick={() => handleMarkServed(order.id)} className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                    <CheckCircle2 className="h-4 w-4" /> Mark Served
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WaiterDashboard;
