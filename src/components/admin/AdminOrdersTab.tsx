import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, Download, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OrderStatus } from '@/store/useStore';
import { DbOrder } from '@/lib/supabase-api';

const statusColors: Record<OrderStatus, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
  SERVED: 'bg-success/10 text-success border-success/30',
};

const statusOptions: (OrderStatus | 'ALL')[] = ['ALL', 'NEW', 'PREPARING', 'READY', 'SERVED'];

interface Props {
  orders: DbOrder[];
}

export default function AdminOrdersTab({ orders }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [sortNewestFirst, setSortNewestFirst] = useState(false);

  const filtered = useMemo(() => {
    let result = orders;

    if (statusFilter !== 'ALL') {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          String(o.table_number).includes(q) ||
          o.items?.some((i) => i.name.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortNewestFirst ? -diff : diff;
    });
  }, [orders, statusFilter, search, sortNewestFirst]);

  const exportCSV = () => {
    const headers = ['Order Time', 'Table', 'Status', 'Items', 'Total'];
    const rows = filtered.map((o) => [
      format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
      String(o.table_number),
      o.status,
      (o.items || []).map((i) => `${i.name} x${i.quantity}`).join('; '),
      String(o.total_price),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by table or item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'secondary'}
              onClick={() => setStatusFilter(s)}
              className="text-xs h-9"
            >
              {s === 'ALL' ? 'All' : s}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{filtered.length} orders</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSortNewestFirst(!sortNewestFirst)} className="text-xs gap-1">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortNewestFirst ? 'Newest First' : 'Oldest First'}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV} className="text-xs gap-1">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No orders found</p>
      ) : (
        filtered.map((order) => (
          <div key={order.id} className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold">Table {order.table_number}</span>
              <Badge variant="outline" className={statusColors[order.status]}>{order.status}</Badge>
            </div>
            <div className="space-y-1">
              {order.items?.map((item) => (
                <div key={item.id} className="text-sm flex justify-between">
                  <span>{item.name} × {item.quantity}</span>
                  <span>₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-2 pt-2 flex items-center justify-between">
              <span className="font-bold text-sm">Total: ₹{order.total_price}</span>
              <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM, hh:mm a')}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
