import { useState, useRef } from 'react';
import { sanitizeField } from '@/lib/sanitize';
import { uploadMenuImage, deleteMenuImage } from '@/lib/image-upload';
import { Plus, Pencil, Trash2, X, Save, Upload, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DbMenuItem,
  createMenuItem,
  updateMenuItem as updateMenuItemApi,
  deleteMenuItem as deleteMenuItemApi,
} from '@/lib/supabase-api';

const emptyForm = { name: '', price: 0, category_id: '', description: '', emoji: '🍽️', image_url: '' };

interface Props {
  menuItems: DbMenuItem[];
  categories: { id: string; name: string }[];
  onReload: () => void;
  setMenuItems: React.Dispatch<React.SetStateAction<DbMenuItem[]>>;
  restaurantId: string;
}

export default function AdminMenuTab({ menuItems, categories, onReload, setMenuItems, restaurantId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DbMenuItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only show non-deleted items in admin menu management
  const visibleItems = menuItems.filter((m) => !m.is_deleted);

  const categoryGroups = categories.map((cat) => ({
    ...cat,
    items: visibleItems.filter((m) => m.category_id === cat.id),
  }));

  const openAdd = () => { setEditingItem(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (item: DbMenuItem) => {
    setEditingItem(item);
    setForm({ name: item.name, price: item.price, category_id: item.category_id, description: item.description || '', emoji: item.emoji || '🍽️', image_url: item.image_url || '' });
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadMenuImage(restaurantId, file);
      setForm((prev) => ({ ...prev, image_url: url }));
      toast.success('Image uploaded');
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const cleanName = sanitizeField(form.name, 200);
    const cleanDesc = sanitizeField(form.description, 500);
    const cleanEmoji = sanitizeField(form.emoji, 10);
    if (!cleanName || !form.category_id || form.price <= 0) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      if (editingItem) {
        await updateMenuItemApi(editingItem.id, { name: cleanName, price: form.price, description: cleanDesc, emoji: cleanEmoji, category_id: form.category_id, image_url: form.image_url || null });
        toast.success(`"${form.name}" updated`);
      } else {
        await createMenuItem({ name: cleanName, price: form.price, description: cleanDesc, emoji: cleanEmoji, category_id: form.category_id, restaurant_id: restaurantId, image_url: form.image_url || null });
        toast.success(`"${cleanName}" added to menu`);
      }
      setDialogOpen(false);
      onReload();
    } catch {
      toast.error('Failed to save menu item');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteMenuItemApi(id); // Now soft-deletes
      setDeleteConfirm(null);
      toast.success(`"${name}" removed from menu`);
      onReload();
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

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
        </div>
        {categoryGroups.map((cat) => (
          <div key={cat.id}>
            <h2 className="text-lg font-bold mb-2">{cat.name}</h2>
            {cat.items.length === 0 && (
              <p className="text-sm text-muted-foreground">No items in this category</p>
            )}
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
    </>
  );
}
