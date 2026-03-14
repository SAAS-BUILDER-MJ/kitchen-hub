import { useState } from 'react';
import { useStore, OrderStatus, MenuItem } from '@/store/useStore';
import { LogOut, LayoutDashboard, Plus, Pencil, Trash2, X, Save, TrendingUp, ShoppingBag, Users, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const statusColors: Record<OrderStatus, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
  SERVED: 'bg-success/10 text-success border-success/30',
};

const emptyForm = { name: '', price: 0, category: '', description: '', image: '🍽️', available: true };

const AdminDashboard = () => {
  const { menu, orders, logout, addMenuItem, updateMenuItem, deleteMenuItem, toggleAvailability, updateOrderStatus } = useStore();
  const [tab, setTab] = useState<'overview' | 'orders' | 'menu'>('overview');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const categories = Array.from(new Set(menu.map((m) => m.category)));

  // Analytics
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const uniqueTables = new Set(orders.map((o) => o.tableNumber)).size;
  const statusCounts: Record<string, number> = {
    NEW: orders.filter((o) => o.status === 'NEW').length,
    PREPARING: orders.filter((o) => o.status === 'PREPARING').length,
    READY: orders.filter((o) => o.status === 'READY').length,
    SERVED: orders.filter((o) => o.status === 'SERVED').length,
  };

  // Popular items
  const itemCounts: Record<string, number> = {};
  orders.forEach((o) => o.items.forEach((item) => {
    itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
  }));
  const popularItems = Object.entries(itemCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({ name: item.name, price: item.price, category: item.category, description: item.description, image: item.image, available: item.available });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.category || form.price <= 0) {
      toast.error('Please fill all required fields');
      return;
    }
    if (editingItem) {
      updateMenuItem(editingItem.id, form);
      toast.success(`"${form.name}" updated`);
    } else {
      addMenuItem({ ...form, available: true });
      toast.success(`"${form.name}" added to menu`);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: number, name: string) => {
    deleteMenuItem(id);
    setDeleteConfirm(null);
    toast.success(`"${name}" removed from menu`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
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
        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<TrendingUp className="h-5 w-5 text-primary" />} label="Revenue" value={`₹${totalRevenue}`} />
              <StatCard icon={<ShoppingBag className="h-5 w-5 text-accent" />} label="Orders" value={String(totalOrders)} />
              <StatCard icon={<Users className="h-5 w-5 text-warning" />} label="Tables Served" value={String(uniqueTables)} />
              <StatCard icon={<TrendingUp className="h-5 w-5 text-success" />} label="Avg. Order" value={`₹${avgOrderValue}`} />
            </div>

            {/* Order Status Breakdown */}
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

            {/* Popular Items */}
            <div className="bg-card rounded-lg border p-4">
              <h2 className="font-bold text-sm mb-3">Popular Items</h2>
              {popularItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet</p>
              ) : (
                <div className="space-y-2">
                  {popularItems.map(([name, count], i) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span>
                        <span className="text-muted-foreground mr-2">#{i + 1}</span>
                        {name}
                      </span>
                      <Badge variant="outline">{count} ordered</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Menu Stats */}
            <div className="bg-card rounded-lg border p-4">
              <h2 className="font-bold text-sm mb-3">Menu Overview</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold">{menu.length}</div>
                  <div className="text-xs text-muted-foreground">Total Items</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{categories.length}</div>
                  <div className="text-xs text-muted-foreground">Categories</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{menu.filter((m) => m.available).length}</div>
                  <div className="text-xs text-muted-foreground">Available</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {tab === 'orders' && (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No orders yet</p>
            ) : (
              [...orders].reverse().map((order) => (
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
                  <div className="border-t mt-2 pt-2 flex items-center justify-between">
                    <span className="font-bold text-sm">Total: ₹{order.total}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* MENU TAB */}
        {tab === 'menu' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
            {categories.map((cat) => (
              <div key={cat}>
                <h2 className="text-lg font-bold mb-2">{cat}</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {menu
                    .filter((m) => m.category === cat)
                    .map((item) => (
                      <div key={item.id} className={`flex items-center gap-3 p-3 bg-card rounded-lg border ${!item.available ? 'opacity-60' : ''}`}>
                        <span className="text-2xl">{item.image}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <h3 className="font-semibold text-sm">{item.name}</h3>
                            {!item.available && (
                              <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/30">Off</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        </div>
                        <span className="font-bold text-sm text-primary shrink-0">₹{item.price}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch
                            checked={item.available}
                            onCheckedChange={() => toggleAvailability(item.id)}
                            className="scale-75"
                          />
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

      {/* Add/Edit Dialog */}
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
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Coffee, Breakfast" list="categories" />
              <datalist id="categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Emoji Icon</label>
              <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="🍽️" className="w-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" /> {editingItem ? 'Update' : 'Add'}
            </Button>
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
