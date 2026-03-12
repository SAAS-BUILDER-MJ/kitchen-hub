import { useState } from 'react';
import { useStore, OrderStatus, MenuItem } from '@/store/useStore';
import { LogOut, LayoutDashboard, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const statusColors: Record<OrderStatus, string> = {
  NEW: 'bg-warning/10 text-warning border-warning/30',
  PREPARING: 'bg-primary/10 text-primary border-primary/30',
  READY: 'bg-accent/10 text-accent border-accent/30',
};

const emptyForm = { name: '', price: 0, category: '', description: '', image: '🍽️' };

const AdminDashboard = () => {
  const { menu, orders, logout, addMenuItem, updateMenuItem, deleteMenuItem } = useStore();
  const [tab, setTab] = useState<'menu' | 'orders'>('orders');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const categories = Array.from(new Set(menu.map((m) => m.category)));

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({ name: item.name, price: item.price, category: item.category, description: item.description, image: item.image });
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
      addMenuItem(form);
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
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border group">
                        <span className="text-2xl">{item.image}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm">{item.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        </div>
                        <span className="font-bold text-sm text-primary shrink-0">₹{item.price}</span>
                        <div className="flex gap-1 shrink-0">
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

export default AdminDashboard;
