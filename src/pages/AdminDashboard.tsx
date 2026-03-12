import { useState } from 'react';
import { useStore, OrderStatus } from '@/store/useStore';
import { LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const statusColors: Record<OrderStatus, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
};

const AdminDashboard = () => {
  const { menu, orders, logout } = useStore();
  const [tab, setTab] = useState<'menu' | 'orders'>('orders');

  const categories = Array.from(new Set(menu.map((m) => m.category)));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 py-3 flex gap-2">
        {(['orders', 'menu'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8">
        {tab === 'orders' ? (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No orders yet</p>
            ) : (
              orders.map((order) => (
                <div key={order.orderId} className="bg-card rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">Order #{order.orderId}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Table {order.tableNumber}</span>
                      <Badge variant="outline" className={statusColors[order.status]}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, i) => (
                      <div key={i} className="text-sm flex justify-between">
                        <span>{item.name} × {item.quantity}</span>
                        <span>₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t mt-2 pt-2 text-right font-bold text-sm">
                    Total: ₹{order.total}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => (
              <div key={cat}>
                <h2 className="text-lg font-bold mb-2">{cat}</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {menu
                    .filter((m) => m.category === cat)
                    .map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border">
                        <span className="text-2xl">{item.image}</span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm">{item.name}</h3>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <span className="font-bold text-sm text-primary">₹{item.price}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
