import { useState } from 'react';
import { useStore, OrderStatus } from '@/store/useStore';
import { LogOut, ChefHat, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const statusColors: Record<OrderStatus, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
};

const nextStatus: Record<OrderStatus, OrderStatus | null> = {
  NEW: 'PREPARING',
  PREPARING: 'READY',
  READY: null,
};

const KitchenDashboard = () => {
  const { orders, updateOrderStatus, logout } = useStore();
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');

  const filtered = filter === 'ALL' ? orders : orders.filter((o) => o.status === filter);
  const counts = {
    NEW: orders.filter((o) => o.status === 'NEW').length,
    PREPARING: orders.filter((o) => o.status === 'PREPARING').length,
    READY: orders.filter((o) => o.status === 'READY').length,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Kitchen Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-4xl mx-auto px-4 py-4 grid grid-cols-3 gap-3">
        {(['NEW', 'PREPARING', 'READY'] as OrderStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? 'ALL' : s)}
            className={`p-3 rounded-lg border text-center transition-colors ${
              filter === s ? statusColors[s] : 'bg-card'
            }`}
          >
            <div className="text-2xl font-bold">{counts[s]}</div>
            <div className="text-xs font-medium">{s}</div>
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="max-w-4xl mx-auto px-4 pb-8 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No orders yet</p>
          </div>
        )}
        {filtered.map((order) => (
          <div key={order.orderId} className="bg-card rounded-lg border p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-bold">Order #{order.orderId}</span>
                <span className="text-muted-foreground text-sm ml-2">· Table {order.tableNumber}</span>
              </div>
              <Badge variant="outline" className={statusColors[order.status]}>
                {order.status}
              </Badge>
            </div>
            <div className="space-y-1 mb-3">
              {order.items.map((item, i) => (
                <div key={i} className="text-sm flex justify-between">
                  <span>{item.name} × {item.quantity}</span>
                  <span className="text-muted-foreground">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-bold text-sm">Total: ₹{order.total}</span>
              {nextStatus[order.status] && (
                <Button
                  size="sm"
                  onClick={() => updateOrderStatus(order.orderId, nextStatus[order.status]!)}
                >
                  {order.status === 'NEW' ? (
                    <>
                      <ChefHat className="h-4 w-4 mr-1" /> Start Preparing
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Ready
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KitchenDashboard;
