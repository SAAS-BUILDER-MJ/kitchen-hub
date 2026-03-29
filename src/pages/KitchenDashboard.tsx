import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore, OrderStatus } from '@/store/useStore';
import { fetchOrders, updateOrderStatus, cancelOrder, subscribeToOrders, DbOrder, DEMO_RESTAURANT_ID } from '@/lib/supabase-api';
import { LogOut, ChefHat, Clock, CheckCircle2, BellRing, UtensilsCrossed, Layers, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
  SERVED: 'bg-success/10 text-success border-success/30',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/30',
};

const nextStatus: Record<string, OrderStatus | null> = {
  NEW: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
  SERVED: null,
  CANCELLED: null,
};

interface DishGroup {
  name: string;
  totalQuantity: number;
  orders: { orderId: string; tableNumber: number; quantity: number }[];
}

// Build a fingerprint of an order's items for change detection
const orderFingerprint = (order: DbOrder): string => {
  const items = (order.items || [])
    .map((i) => `${i.menu_item_id}:${i.quantity}:${i.notes || ''}`)
    .sort()
    .join('|');
  return `${items}::${order.total_price}`;
};

const playNotificationSound = (frequency1: number, frequency2: number) => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = frequency1; gain.gain.value = 0.3;
    osc.start(); osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.frequency.value = frequency2; gain2.gain.value = 0.3;
      osc2.start(); osc2.stop(ctx.currentTime + 0.15);
    }, 180);
  } catch {}
};

const KitchenDashboard = () => {
  const { logout, auth } = useStore();
  const restaurantId = auth.userRestaurantId || DEMO_RESTAURANT_ID;
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [showDishGrouping, setShowDishGrouping] = useState(false);
  const [cancelDialogOrder, setCancelDialogOrder] = useState<DbOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [modifiedOrderIds, setModifiedOrderIds] = useState<Set<string>>(new Set());
  const prevOrderCount = useRef(0);
  const orderFingerprintsRef = useRef<Map<string, string>>(new Map());

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchOrders(restaurantId);
      const prevFingerprints = orderFingerprintsRef.current;
      const newFingerprints = new Map<string, string>();

      // Detect modified PREPARING orders
      const newlyModified: string[] = [];
      data.forEach((order) => {
        const fp = orderFingerprint(order);
        newFingerprints.set(order.id, fp);

        if (
          order.status === 'PREPARING' &&
          prevFingerprints.has(order.id) &&
          prevFingerprints.get(order.id) !== fp
        ) {
          newlyModified.push(order.id);
        }
      });

      if (newlyModified.length > 0) {
        const modifiedOrders = data.filter((o) => newlyModified.includes(o.id));
        modifiedOrders.forEach((o) => {
          toast.warning(
            `⚠️ Order for Table ${o.table_number} was MODIFIED by customer!`,
            { duration: 10000, id: `mod-${o.id}` }
          );
        });
        setModifiedOrderIds((prev) => {
          const next = new Set(prev);
          newlyModified.forEach((id) => next.add(id));
          return next;
        });
        playNotificationSound(600, 900);
      }

      orderFingerprintsRef.current = newFingerprints;
      setOrders(data);

      // New order detection
      const newCount = data.filter((o) => o.status === 'NEW').length;
      if (newCount > prevOrderCount.current && prevOrderCount.current > 0) {
        toast.info(`🔔 New order received!`, { duration: 5000 });
        playNotificationSound(800, 1000);
      }
      prevOrderCount.current = newCount;
    } catch {}
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    const unsub = subscribeToOrders(DEMO_RESTAURANT_ID, loadOrders);
    return unsub;
  }, [loadOrders]);

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      if (status === 'SERVED') toast.success('Order marked as served');
    } catch {
      toast.error('Failed to update order status');
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelDialogOrder) return;
    setCancellingId(cancelDialogOrder.id);
    try {
      await cancelOrder(cancelDialogOrder.id, 'staff', cancelReason || 'Cancelled by staff');
      setOrders((prev) => prev.map((o) => o.id === cancelDialogOrder.id ? { ...o, status: 'CANCELLED' as OrderStatus } : o));
      toast.success('Order cancelled');
      setCancelDialogOrder(null);
      setCancelReason('');
    } catch {
      toast.error('Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  // Filter out SERVED and CANCELLED orders from kitchen view
  const activeOrders = useMemo(() =>
    orders
      .filter((o) => o.status !== 'SERVED' && o.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  );

  const displayed = useMemo(() =>
    filter === 'ALL' ? activeOrders : activeOrders.filter((o) => o.status === filter),
    [activeOrders, filter]
  );

  const counts: Record<string, number> = {
    NEW: activeOrders.filter((o) => o.status === 'NEW').length,
    PREPARING: activeOrders.filter((o) => o.status === 'PREPARING').length,
    READY: activeOrders.filter((o) => o.status === 'READY').length,
  };

  const dishGroups = useMemo((): DishGroup[] => {
    const groupMap = new Map<string, DishGroup>();
    activeOrders
      .filter((o) => o.status === 'NEW' || o.status === 'PREPARING')
      .forEach((order) => {
        order.items?.forEach((item) => {
          const existing = groupMap.get(item.name);
          if (existing) {
            existing.totalQuantity += item.quantity;
            existing.orders.push({ orderId: order.id, tableNumber: order.table_number, quantity: item.quantity });
          } else {
            groupMap.set(item.name, {
              name: item.name,
              totalQuantity: item.quantity,
              orders: [{ orderId: order.id, tableNumber: order.table_number, quantity: item.quantity }],
            });
          }
        });
      });
    return Array.from(groupMap.values())
      .filter((g) => g.orders.length > 1)
      .sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [activeOrders]);

  const getActionButton = (status: OrderStatus) => {
    switch (status) {
      case 'NEW': return { label: 'Start Preparing', icon: <ChefHat className="h-4 w-4 mr-1" /> };
      case 'PREPARING': return { label: 'Mark Ready', icon: <CheckCircle2 className="h-4 w-4 mr-1" /> };
      case 'READY': return { label: 'Mark Served', icon: <UtensilsCrossed className="h-4 w-4 mr-1" /> };
      default: return null;
    }
  };

  const isDishCommon = (itemName: string) => dishGroups.some((g) => g.name === itemName);

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
          <div className="flex items-center gap-2">
            <Button
              variant={showDishGrouping ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowDishGrouping(!showDishGrouping)}
              className="gap-1"
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Dish Groups</span>
              {dishGroups.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {dishGroups.length}
                </Badge>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 grid grid-cols-3 gap-2 sm:gap-3">
        {(['NEW', 'PREPARING', 'READY'] as OrderStatus[]).map((s) => (
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

      {/* Dish Grouping Panel */}
      {showDishGrouping && dishGroups.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Common Dishes Across Orders
              <span className="text-xs text-muted-foreground font-normal">— prepare in bulk</span>
            </h2>
            <div className="space-y-2">
              {dishGroups.map((group) => (
                <div key={group.name} className="bg-card rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{group.name}</span>
                    <Badge variant="default" className="bg-primary/90">Total: {group.totalQuantity}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.orders.map((o) => (
                      <Badge key={o.orderId} variant="outline" className="text-xs">
                        Table {o.tableNumber} × {o.quantity}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDishGrouping && dishGroups.length === 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-4">
          <div className="bg-muted rounded-lg p-4 text-center text-sm text-muted-foreground">
            No common dishes across current orders.
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pb-8 space-y-3">
        {displayed.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No active orders</p>
          </div>
        )}
        {displayed.map((order) => {
          const action = getActionButton(order.status);
          const isModified = modifiedOrderIds.has(order.id);
          return (
            <div
              key={order.id}
              className={`bg-card rounded-lg border p-4 animate-slide-up ${order.status === 'NEW' ? 'border-warning/50 shadow-md' : ''} ${isModified ? 'border-orange-500 ring-2 ring-orange-400/50 shadow-lg' : ''}`}
            >
              {/* Modified banner */}
              {isModified && (
                <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-md px-3 py-2 mb-3 -mt-1">
                  <span className="text-sm font-semibold text-orange-600 flex items-center gap-1.5">
                    ⚠️ Customer modified this order — review updated items
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-orange-600 hover:text-orange-700"
                    onClick={() => setModifiedOrderIds((prev) => {
                      const next = new Set(prev);
                      next.delete(order.id);
                      return next;
                    })}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {order.status === 'NEW' && <BellRing className="h-4 w-4 text-warning animate-bounce" />}
                  <span className="font-bold">Table {order.table_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isModified && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-[10px]">MODIFIED</Badge>}
                  <Badge variant="outline" className={statusColors[order.status]}>{order.status}</Badge>
                </div>
              </div>
              <div className="space-y-1 mb-3">
                {order.items?.map((item) => (
                  <div key={item.id}>
                    <div className={`text-sm flex justify-between items-center ${isDishCommon(item.name) ? 'bg-primary/5 rounded px-2 py-0.5 -mx-2' : ''}`}>
                      <span className="flex items-center gap-1">
                        {item.name} × {item.quantity}
                        {isDishCommon(item.name) && <Layers className="h-3 w-3 text-primary" />}
                      </span>
                      <span className="text-muted-foreground">₹{item.price * item.quantity}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-warning font-medium ml-2 mt-0.5">⚠️ {item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="font-bold text-sm">Total: ₹{order.total_price}</span>
                <div className="flex items-center gap-2">
                  {/* Staff cancel button */}
                  {(order.status === 'NEW' || order.status === 'PREPARING') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => { setCancelDialogOrder(order); setCancelReason(''); }}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  )}
                  {action && nextStatus[order.status] && (
                    <Button size="sm" onClick={() => handleStatusUpdate(order.id, nextStatus[order.status]!)}>
                      {action.icon} {action.label}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelDialogOrder} onOpenChange={(open) => { if (!open) setCancelDialogOrder(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order — Table {cancelDialogOrder?.table_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Please provide a reason for cancelling this order.</p>
            <Input
              placeholder="e.g. Customer left, item unavailable..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOrder(null)}>Keep Order</Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={cancellingId === cancelDialogOrder?.id}
            >
              {cancellingId === cancelDialogOrder?.id ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KitchenDashboard;
