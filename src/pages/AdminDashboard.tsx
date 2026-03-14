import { useState, useEffect, useCallback } from 'react';
import { useStore, OrderStatus } from '@/store/useStore';
import {
  fetchMenuItems, fetchCategories, fetchOrders,
  createMenuItem, updateMenuItem as updateMenuItemApi,
  deleteMenuItem as deleteMenuItemApi, DbMenuItem, DbOrder, DEMO_RESTAURANT_ID,
} from '@/lib/supabase-api';
import { LogOut, LayoutDashboard, Plus, Pencil, Trash2, X, Save, TrendingUp, ShoppingBag, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const statusColors: Record<OrderStatus, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
  SERVED: 'bg-success/10 text-success border-success/30',
};

const emptyForm = { name: '', price: 0, category_id: '', description: '', emoji: '🍽️' };

const AdminDashboard = () => {
  const { logout } = useStore();
  const [tab, setTab] = useState<'overview' | 'orders' | 'menu'>('overview');
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DbMenuItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [items, cats, ords] = await Promise.all([
        fetchMenuItems(), fetchCategories(), fetchOrders(),
      ]);
      setMenuItems(items);
      setCategories(cats);
      setOrders(ords);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Analytics
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const uniqueTables = new Set(orders.map((o) => o.table_number)).size;
  const statusCounts: Record<string, number> = {
    NEW: orders.filter((o) => o.status === 'NEW').length,
    PREPARING: orders.filter((o) => o.status === 'PREPARING').length,
    READY: orders.filter((o) => o.status === 'READY').length,
    SERVED: orders.filter((o) => o.status === 'SERVED').length,
  };

  const itemCounts: Record<string, number> = {};
  orders.forEach((o) => o.items?.forEach((item) => {
    itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
  }));
  const popularItems = Object.entries(itemCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

  const categoryGroups = categories.map((cat) => ({
    ...cat,
    items: menuItems.filter((m) => m.category_id === cat.id),
  }));

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: DbMenuItem) => {
    setEditingItem(item);
    setForm({ name: item.name, price: item.price, category_id: item.category_id, description: item.description || '', emoji: item.emoji || '🍽️' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.category_id || form.price <= 0) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      if (editingItem) {
        await updateMenuItemApi(editingItem.id, { name: form.name, price: form.price, description: form.description, emoji: form.emoji, category_id: form.category_id });
        toast.success(`"${form.name}" updated`);
      } else {
        await createMenuItem({ name: form.name, price: form.price, description: form.description, emoji: form.emoji, category_id: form.category_id });
        toast.success(`"${form.name}" added to menu`);
      }
      setDialogOpen(false);
      loadData();
    } catch {
      toast.error('Failed to save menu item');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteMenuItemApi(id);
      setDeleteConfirm(null);
      toast.success(`"${name}" removed from menu`);
      loadData();
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleToggleAvailability = async (item: DbMenuItem) => {
    try {
      await updateMenuItemApi(item.id, { available: !item.available });
      setMenuItems((prev) => prev.map((m) => m.id === item.id ? { ...m, available: !m.available } : m));
    } catch {
      toast.error('Failed to update availability');
    }
  };

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

      <div className="max-w-5xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
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

      <div className="max-w-5xl mx-auto px-4 pb-8">
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<TrendingUp className="h-5 w-5 text-primary" />} label="Revenue" value={`₹${totalRevenue}`} />
              <StatCard icon={<ShoppingBag className="h-5 w-5 text-accent" />} label="Orders" value={String(totalOrders)} />
              <StatCard icon={<Users className="h-5 w-5 text-warning" />} label="Tables Served" value={String(uniqueTables)} />
              <StatCard icon={<TrendingUp className="h-5 w-5 text-success" />} label="Avg. Order" value={`₹${avgOrderValue}`} />
            </div>

            <div className="bg-card rounded-lg border p-4">
              <h2 className="font-bold text-sm mb-3">Order Status Breakdown</h2>
              <div className="grid grid-cols-4 gap-2">
                {(['NEW', 'PREPARING', 'READY', 'SERVED'] as OrderStatus[]).map((s) => (
                  <div key={s} className={`p-3 rounded-lg text-center ${statusColors[s]}`}>
                    <div className="text-xl font-bold">{statusCounts[s]}</div>
                    <div className="text-[10px] font-medium">{s}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <h2 className="font-bold text-sm mb-3">Popular Items</h2>
              {popularItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet</p>
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
                <div><div className="text-xl font-bold">{menuItems.length}</div><div className="text-xs text-muted-foreground">Total Items</div></div>
                <div><div className="text-xl font-bold">{categories.length}</div><div className="text-xs text-muted-foreground">Categories</div></div>
                <div><div className="text-xl font-bold">{menuItems.filter((m) => m.available).length}</div><div className="text-xs text-muted-foreground">Available</div></div>
              </div>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No orders yet</p>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="bg-card rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">Table {order.table_number}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColors[order.status]}>{order.status}</Badge>
                    </div>
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
                    <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'menu' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
            </div>
            {categoryGroups.map((cat) => (
              <div key={cat.id}>
                <h2 className="text-lg font-bold mb-2">{cat.name}</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {cat.items.map((item) => (
                    <div key={item.id} className={`flex items-center gap-3 p-3 bg-card rounded-lg border ${!item.available ? 'opacity-60' : ''}`}>
                      <span className="text-2xl">{item.emoji || '🍽️'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h3 className="font-semibold text-sm">{item.name}</h3>
                          {!item.available && <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/30">Off</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      </div>
                      <span className="font-bold text-sm text-primary shrink-0">₹{item.price}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch checked={item.available} onCheckedChange={() => handleToggleAvailability(item)} className="scale-75" />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {deleteConfirm === item.id ? (
                          <div className="flex gap-1">
                            <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id, item.name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Price (₹) *</label>
              <Input type="number" value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} placeholder="0" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Category *</label>
              <Select value={form.category_id} onValueChange={(val) => setForm({ ...form, category_id: val })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Emoji Icon</label>
              <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} placeholder="🍽️" className="w-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> {editingItem ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-card rounded-lg border p-4 flex flex-col items-center gap-1">
    {icon}
    <span className="text-xl font-bold">{value}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

export default AdminDashboard;
