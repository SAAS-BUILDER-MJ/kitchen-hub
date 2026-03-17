import { useMemo } from 'react';
import { getHours } from 'date-fns';
import { TrendingUp, ShoppingBag, Users, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { OrderStatus } from '@/store/useStore';
import { DbOrder } from '@/lib/supabase-api';

const statusColors: Record<string, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
  SERVED: 'bg-success/10 text-success border-success/30',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/30',
};

interface Props {
  orders: DbOrder[];
  menuItemsCount: number;
  categoriesCount: number;
  availableCount: number;
}

export default function AdminOverviewTab({ orders, menuItemsCount, categoriesCount, availableCount }: Props) {
  // Revenue only counts SERVED orders
  const servedOrders = orders.filter((o) => o.status === 'SERVED');
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;
  const totalRevenue = servedOrders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const totalOrders = orders.length;
  const servedCount = servedOrders.length;
  const avgOrderValue = servedCount > 0 ? Math.round(totalRevenue / servedCount) : 0;
  const uniqueTables = new Set(servedOrders.map((o) => o.table_number)).size;

  const statusCounts: Record<string, number> = {
    NEW: orders.filter((o) => o.status === 'NEW').length,
    PREPARING: orders.filter((o) => o.status === 'PREPARING').length,
    READY: orders.filter((o) => o.status === 'READY').length,
    SERVED: servedCount,
    CANCELLED: cancelledCount,
  };

  const itemCounts: Record<string, number> = {};
  orders.forEach((o) =>
    o.items?.forEach((item) => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
    })
  );
  const popularItems = Object.entries(itemCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

  const hourlyData = useMemo(() => {
    const buckets: Record<number, number> = {};
    servedOrders.forEach((o) => {
      const h = getHours(new Date(o.created_at));
      buckets[h] = (buckets[h] || 0) + Number(o.total_price);
    });
    const hours = Object.keys(buckets).map(Number).sort((a, b) => a - b);
    if (hours.length === 0) return [];
    const min = hours[0];
    const max = hours[hours.length - 1];
    const result = [];
    for (let h = min; h <= max; h++) {
      result.push({ hour: `${h}:00`, revenue: buckets[h] || 0 });
    }
    return result;
  }, [servedOrders]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<TrendingUp className="h-5 w-5 text-primary" />} label="Revenue (Served)" value={`₹${totalRevenue}`} />
        <StatCard icon={<ShoppingBag className="h-5 w-5 text-accent" />} label="Total Orders" value={String(totalOrders)} />
        <StatCard icon={<Users className="h-5 w-5 text-warning" />} label="Tables Served" value={String(uniqueTables)} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-success" />} label="Avg. Order (Served)" value={`₹${avgOrderValue}`} />
      </div>

      {cancelledCount > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive font-medium">{cancelledCount} cancelled order{cancelledCount > 1 ? 's' : ''} (excluded from revenue)</span>
        </div>
      )}

      <div className="bg-card rounded-lg border p-4">
        <h2 className="font-bold text-sm mb-3">Order Status Breakdown</h2>
        <div className="grid grid-cols-5 gap-2">
          {(['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'] as OrderStatus[]).map((s) => (
            <div key={s} className={`p-3 rounded-lg text-center ${statusColors[s]}`}>
              <div className="text-xl font-bold">{statusCounts[s]}</div>
              <div className="text-[10px] font-medium">{s}</div>
            </div>
          ))}
        </div>
      </div>

      {hourlyData.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h2 className="font-bold text-sm mb-3">Revenue by Hour (Served Only)</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  formatter={(value: number) => [`₹${value}`, 'Revenue']}
                  contentStyle={{ borderRadius: '0.5rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border p-4">
        <h2 className="font-bold text-sm mb-3">Popular Items</h2>
        {popularItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders in this period</p>
        ) : (
          <div className="space-y-2">
            {popularItems.map(([name, count], i) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span><span className="text-muted-foreground mr-2">#{i + 1}</span>{name}</span>
                <Badge variant="outline">{count} ordered</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-lg border p-4">
        <h2 className="font-bold text-sm mb-3">Menu Overview</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><div className="text-xl font-bold">{menuItemsCount}</div><div className="text-xs text-muted-foreground">Total Items</div></div>
          <div><div className="text-xl font-bold">{categoriesCount}</div><div className="text-xs text-muted-foreground">Categories</div></div>
          <div><div className="text-xl font-bold">{availableCount}</div><div className="text-xs text-muted-foreground">Available</div></div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg border p-4 flex flex-col items-center gap-1">
      {icon}
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
