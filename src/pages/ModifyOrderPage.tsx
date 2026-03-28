import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { fetchOrder, fetchMenuItems, subscribeToOrder, DbOrder, DbMenuItem } from '@/lib/supabase-api';
import { ArrowLeft, Minus, Plus, Trash2, MessageSquare, Search, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ModifyItem {
  menu_item_id: string;
  name: string;
  price: number;
  emoji: string;
  quantity: number;
  notes: string;
}

const MODIFIABLE_STATUSES = ['NEW', 'PREPARING'];

const ModifyOrderPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { tableNumber, tableId, restaurantId } = useStore();

  const [order, setOrder] = useState<DbOrder | null>(null);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [items, setItems] = useState<ModifyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const canModify = order && MODIFIABLE_STATUSES.includes(order.status);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const o = await fetchOrder(orderId);
      setOrder(o);
      // Only set items from order on initial load
      if (items.length === 0) {
        setItems(
          (o.items || []).map((i) => ({
            menu_item_id: i.menu_item_id,
            name: i.name,
            price: i.price,
            emoji: '🍽️',
            quantity: i.quantity,
            notes: i.notes || '',
          }))
        );
      }
    } catch {
      toast.error('Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  useEffect(() => {
    if (!orderId) return;
    return subscribeToOrder(orderId, () => {
      // Re-fetch to check if status changed
      if (orderId) {
        fetchOrder(orderId).then((o) => {
          setOrder(o);
          if (!MODIFIABLE_STATUSES.includes(o.status)) {
            toast.error('Order status changed. Modifications are no longer allowed.');
          }
        }).catch(() => {});
      }
    });
  }, [orderId]);

  useEffect(() => {
    fetchMenuItems(restaurantId).then(setMenuItems).catch(() => {});
  }, [restaurantId]);

  // Enrich items with emoji from menu
  useEffect(() => {
    if (menuItems.length > 0 && items.length > 0) {
      const menuMap = new Map(menuItems.map((m) => [m.id, m]));
      setItems((prev) =>
        prev.map((item) => {
          const mi = menuMap.get(item.menu_item_id);
          return mi?.emoji ? { ...item, emoji: mi.emoji } : item;
        })
      );
    }
  }, [menuItems.length > 0]); // Only run once when menu loads

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.menu_item_id !== menuItemId));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.menu_item_id === menuItemId ? { ...i, quantity: Math.min(quantity, 99) } : i))
      );
    }
  };

  const updateNotes = (menuItemId: string, notes: string) => {
    setItems((prev) =>
      prev.map((i) => (i.menu_item_id === menuItemId ? { ...i, notes: notes.slice(0, 500) } : i))
    );
  };

  const addFromMenu = (menuItem: DbMenuItem) => {
    const existing = items.find((i) => i.menu_item_id === menuItem.id);
    if (existing) {
      updateQuantity(menuItem.id, existing.quantity + 1);
    } else {
      setItems((prev) => [
        ...prev,
        {
          menu_item_id: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          emoji: menuItem.emoji || '🍽️',
          quantity: 1,
          notes: '',
        },
      ]);
    }
    toast.success(`Added ${menuItem.name}`);
  };

  const toggleNotes = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSave = async () => {
    const resolvedTableId = order?.table_id || tableId;
    if (!orderId || !resolvedTableId || items.length === 0) {
      toast.error(items.length === 0 ? 'Order must have at least one item' : 'Missing table context');
      return;
    }

    setSaving(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/modify-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            order_id: orderId,
            table_id: resolvedTableId,
            items: items.map((i) => ({
              menu_item_id: i.menu_item_id,
              name: i.name,
              quantity: i.quantity,
              price: i.price,
              notes: i.notes || null,
            })),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to modify order');
        return;
      }

      toast.success('Order updated successfully!');
      navigate(`/order-confirmation/${orderId}`);
    } catch {
      toast.error('Failed to modify order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredMenu = menuItems
    .filter((m) => m.available && !m.is_deleted)
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 flex-col gap-4">
        <p className="text-muted-foreground">Order not found</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  if (!canModify) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 flex-col gap-4">
        <div className="text-center">
          <span className="text-5xl mb-4 block">🔒</span>
          <h2 className="text-xl font-bold mb-2">Cannot Modify Order</h2>
          <p className="text-muted-foreground">
            This order is <span className="font-semibold">{order.status}</span> and can no longer be modified.
          </p>
        </div>
        <Button onClick={() => navigate(`/order-status/${orderId}`)}>View Order Status</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-36">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Modify Order</h1>
            <p className="text-xs text-muted-foreground">
              Table {order.table_number} · Status: {order.status}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMenu(!showMenu)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Items
          </Button>
        </div>
      </header>

      {/* Add from menu panel */}
      {showMenu && (
        <div className="border-b bg-card">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Search menu items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredMenu.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No items found</p>
              )}
              {filteredMenu.map((mi) => {
                const inOrder = items.find((i) => i.menu_item_id === mi.id);
                return (
                  <button
                    key={mi.id}
                    onClick={() => addFromMenu(mi)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                  >
                    <span className="text-2xl">{mi.emoji || '🍽️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mi.name}</p>
                      <p className="text-xs text-primary font-semibold">₹{mi.price}</p>
                    </div>
                    {inOrder && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        ×{inOrder.quantity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Current items */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" />
          Order Items ({items.length})
        </h2>

        {items.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No items in order. Add items from the menu above.</p>
          </div>
        )}

        {items.map((item) => (
          <div key={item.menu_item_id} className="p-4 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">{item.name}</h3>
                <p className="text-sm font-bold text-primary">₹{item.price * item.quantity}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)}
                  className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center"
                >
                  {item.quantity === 1 ? (
                    <Trash2 className="h-3 w-3 text-destructive" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                </button>
                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)}
                  className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
            {/* Notes */}
            <button
              onClick={() => toggleNotes(item.menu_item_id)}
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              {item.notes ? 'Edit special instructions' : 'Add special instructions'}
            </button>
            {expandedNotes.has(item.menu_item_id) && (
              <Input
                className="mt-2 h-8 text-xs"
                placeholder="e.g. no onions, extra spicy"
                value={item.notes}
                onChange={(e) => updateNotes(item.menu_item_id, e.target.value)}
                autoFocus
              />
            )}
            {!expandedNotes.has(item.menu_item_id) && item.notes && (
              <p className="mt-1 text-xs text-muted-foreground italic">📝 {item.notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Updated Total</span>
            <span className="font-semibold">₹{total}</span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 py-6 text-base font-semibold"
              onClick={handleSave}
              disabled={saving || items.length === 0}
            >
              {saving ? 'Saving...' : `Save Changes · ₹${total}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModifyOrderPage;
