import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import {
  fetchMenuItems, fetchCategories, fetchOrders,
  DbMenuItem, DbOrder, DEMO_RESTAURANT_ID,
} from '@/lib/supabase-api';
import { LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminDateFilter, { DateRange, getDateRange } from '@/components/admin/AdminDateFilter';
import AdminOverviewTab from '@/components/admin/AdminOverviewTab';
import AdminOrdersTab from '@/components/admin/AdminOrdersTab';
import AdminMenuTab from '@/components/admin/AdminMenuTab';

const AdminDashboard = () => {
  const { logout } = useStore();
  const [tab, setTab] = useState<'overview' | 'orders' | 'menu'>('overview');
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [allOrders, setAllOrders] = useState<DbOrder[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('today'));
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [items, cats, ords] = await Promise.all([
        fetchMenuItems(), fetchCategories(), fetchOrders(),
      ]);
      setMenuItems(items);
      setCategories(cats);
      setAllOrders(ords);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= dateRange.from.getTime() && t <= dateRange.to.getTime();
    });
  }, [allOrders, dateRange]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">
        {/* Tab switcher */}
        <div className="flex gap-2 overflow-x-auto">
          {(['overview', 'orders', 'menu'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize shrink-0 ${
                tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Date filter — visible on overview & orders tabs */}
        {(tab === 'overview' || tab === 'orders') && (
          <AdminDateFilter dateRange={dateRange} onChange={setDateRange} />
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-8">
        {tab === 'overview' && (
          <AdminOverviewTab
            orders={filteredOrders}
            menuItemsCount={menuItems.length}
            categoriesCount={categories.length}
            availableCount={menuItems.filter((m) => m.available).length}
          />
        )}
        {tab === 'orders' && <AdminOrdersTab orders={filteredOrders} />}
        {tab === 'menu' && (
          <AdminMenuTab
            menuItems={menuItems}
            categories={categories}
            onReload={loadData}
            setMenuItems={setMenuItems}
          />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
