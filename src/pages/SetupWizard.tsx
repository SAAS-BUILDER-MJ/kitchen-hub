import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/integrations/supabase/client';
import { fetchTablesWithQr, rotateQrCode } from '@/lib/qr-api';
import { fetchCategories, createMenuItem, fetchMenuItems } from '@/lib/supabase-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, ArrowLeft, Plus, Trash2, ChefHat, Table2, Tags, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'tables' | 'categories' | 'menu' | 'done';
const STEPS: Step[] = ['tables', 'categories', 'menu', 'done'];

const SetupWizard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurant_id');
  const { auth, checkAuth } = useStore();

  const [currentStep, setCurrentStep] = useState<Step>('tables');
  const [loading, setLoading] = useState(false);

  // Tables
  const [tables, setTables] = useState<{ id: string; table_number: number; is_active: boolean }[]>([]);
  const [newTableCount, setNewTableCount] = useState('');

  // Categories
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [newCatName, setNewCatName] = useState('');

  // Menu Items
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemEmoji, setItemEmoji] = useState('🍽️');
  const [itemDescription, setItemDescription] = useState('');

  useEffect(() => {
    if (!restaurantId) {
      navigate('/admin');
      return;
    }
    checkAuth();
  }, [restaurantId, navigate, checkAuth]);

  const loadTables = useCallback(async () => {
    if (!restaurantId) return;
    const data = await fetchTablesWithQr(restaurantId);
    setTables(data);
  }, [restaurantId]);

  const loadCategories = useCallback(async () => {
    if (!restaurantId) return;
    const data = await fetchCategories(restaurantId);
    setCategories(data);
    if (data.length > 0 && !itemCategoryId) setItemCategoryId(data[0].id);
  }, [restaurantId, itemCategoryId]);

  const loadMenuItems = useCallback(async () => {
    if (!restaurantId) return;
    const data = await fetchMenuItems(restaurantId);
    setMenuItems(data);
  }, [restaurantId]);

  useEffect(() => {
    loadTables();
    loadCategories();
    loadMenuItems();
  }, [loadTables, loadCategories, loadMenuItems]);

  const handleBulkAddTables = async () => {
    const count = parseInt(newTableCount);
    if (!count || count < 1 || count > 50) {
      toast.error('Enter a number between 1 and 50');
      return;
    }
    setLoading(true);
    try {
      const existingNumbers = tables.map((t) => t.table_number);
      const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      const newTables = Array.from({ length: count }, (_, i) => ({
        restaurant_id: restaurantId!,
        table_number: maxNum + i + 1,
      }));
      const { error } = await supabase.from('tables').insert(newTables);
      if (error) throw error;
      toast.success(`Added ${count} tables`);
      setNewTableCount('');
      await loadTables();
    } catch {
      toast.error('Failed to add tables');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAllQr = async () => {
    setLoading(true);
    try {
      for (const t of tables) {
        if (!t.is_active) continue;
        await rotateQrCode(t.id);
      }
      toast.success('QR codes generated for all active tables');
      await loadTables();
    } catch {
      toast.error('Failed to generate QR codes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('menu_categories').insert({
        restaurant_id: restaurantId!,
        name: newCatName.trim(),
        sort_order: categories.length,
      });
      if (error) throw error;
      toast.success('Category added');
      setNewCatName('');
      await loadCategories();
    } catch {
      toast.error('Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('menu_categories').delete().eq('id', id);
      if (error) throw error;
      toast.success('Category removed');
      await loadCategories();
    } catch {
      toast.error('Failed to delete — category may have items');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMenuItem = async () => {
    if (!itemName.trim() || !itemPrice || !itemCategoryId) {
      toast.error('Name, price, and category are required');
      return;
    }
    const price = parseFloat(itemPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    setLoading(true);
    try {
      await createMenuItem({
        name: itemName.trim(),
        description: itemDescription.trim(),
        price,
        emoji: itemEmoji || '🍽️',
        category_id: itemCategoryId,
        restaurant_id: restaurantId!,
      });
      toast.success('Item added');
      setItemName('');
      setItemPrice('');
      setItemDescription('');
      setItemEmoji('🍽️');
      await loadMenuItems();
    } catch {
      toast.error('Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = STEPS.indexOf(currentStep);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setCurrentStep(STEPS[stepIndex + 1]);
  };
  const goBack = () => {
    if (stepIndex > 0) setCurrentStep(STEPS[stepIndex - 1]);
  };

  const handleFinish = () => {
    toast.success('Setup complete! Redirecting to dashboard...');
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
            <ChefHat className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Setup Your Restaurant</h1>
          <p className="text-muted-foreground text-sm mt-1">Complete these steps to get started</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`h-2 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          ))}
        </div>

        {/* Step content */}
        {currentStep === 'tables' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Table2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Tables</h2>
              <Badge variant="secondary">{tables.length} tables</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Your restaurant starts with 5 tables. Add more or generate QR codes.
            </p>

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Add more tables..."
                value={newTableCount}
                onChange={(e) => setNewTableCount(e.target.value)}
                min={1}
                max={50}
              />
              <Button onClick={handleBulkAddTables} disabled={loading}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGenerateAllQr} disabled={loading}>
              Generate QR Codes for All Tables
            </Button>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {tables.map((t) => (
                <Card key={t.id} className="p-3 text-center">
                  <p className="font-semibold">T{t.table_number}</p>
                  <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px] mt-1">
                    {t.is_active ? 'Active' : 'Off'}
                  </Badge>
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'categories' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Tags className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Menu Categories</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Default categories have been created. Add, remove, or keep them.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="New category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
              />
              <Button onClick={handleAddCategory} disabled={loading}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-card border">
                  <span className="font-medium">{cat.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'menu' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Menu Items</h2>
              <Badge variant="secondary">{menuItems.length} items</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Add your dishes. You can always add more from the admin dashboard later.
            </p>

            <Card className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input placeholder="Margherita Pizza" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Price *</Label>
                  <Input type="number" step="0.01" min="0.01" placeholder="12.99" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Category *</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Emoji</Label>
                  <Input placeholder="🍕" value={itemEmoji} onChange={(e) => setItemEmoji(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input placeholder="Fresh mozzarella, basil, tomato sauce" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} />
              </div>
              <Button onClick={handleAddMenuItem} disabled={loading} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </Card>

            {menuItems.length > 0 && (
              <div className="space-y-2">
                {menuItems.slice(0, 10).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-card border text-sm">
                    <span>{item.emoji}</span>
                    <span className="font-medium flex-1">{item.name}</span>
                    <span className="text-muted-foreground">${item.price.toFixed(2)}</span>
                  </div>
                ))}
                {menuItems.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">+{menuItems.length - 10} more items</p>
                )}
              </div>
            )}
          </div>
        )}

        {currentStep === 'done' && (
          <div className="text-center space-y-4 py-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-accent/10">
              <Check className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-xl font-bold">You're All Set!</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Your restaurant has {tables.length} tables, {categories.length} categories, and {menuItems.length} menu items.
              You can manage everything from the admin dashboard.
            </p>
            <Button size="lg" onClick={handleFinish}>
              Go to Dashboard <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Navigation */}
        {currentStep !== 'done' && (
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={goBack} disabled={stepIndex === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button onClick={goNext}>
              {stepIndex === STEPS.length - 2 ? 'Finish' : 'Next'} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
