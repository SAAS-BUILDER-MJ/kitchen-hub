import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useStore, MenuItem } from '@/store/useStore';
import { ShoppingCart, Plus, Minus, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MenuPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { menu, cart, addToCart, removeFromCart, updateQuantity, setTableNumber, tableNumber } = useStore();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const table = searchParams.get('table');
    if (table) setTableNumber(parseInt(table, 10));
  }, [searchParams, setTableNumber]);

  const categories = ['All', ...Array.from(new Set(menu.map((m) => m.category)))];
  
  const filtered = menu.filter((m) => {
    const matchesCategory = activeCategory === 'All' || m.category === activeCategory;
    const matchesSearch = !searchQuery || 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const getCartQty = (id: number) => cart.find((c) => c.id === id)?.quantity || 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🍽️ Menu</h1>
            <p className="text-xs text-muted-foreground">Table {tableNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(!showSearch)}
              className="h-9 w-9"
            >
              {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="relative"
              onClick={() => navigate('/cart')}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Cart
              {cartCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
        {showSearch && (
          <div className="max-w-2xl mx-auto mt-2">
            <Input
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>
        )}
      </header>

      {/* Category Tabs */}
      <div className="sticky top-[57px] z-20 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {filtered.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">No items found</p>
        )}
        {filtered.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            quantity={getCartQty(item.id)}
            onAdd={() => addToCart(item)}
            onRemove={() => {
              const qty = getCartQty(item.id);
              if (qty <= 1) removeFromCart(item.id);
              else updateQuantity(item.id, qty - 1);
            }}
          />
        ))}
      </div>

      {/* Floating Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t animate-slide-up">
          <div className="max-w-2xl mx-auto">
            <Button
              className="w-full py-6 text-base font-semibold"
              onClick={() => navigate('/cart')}
            >
              View Cart · {cartCount} item{cartCount > 1 ? 's' : ''} · ₹
              {cart.reduce((s, c) => s + c.price * c.quantity, 0)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuItemCard = ({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) => (
  <div className={`flex items-center gap-4 p-4 bg-card rounded-lg border shadow-sm animate-slide-up ${
    !item.available ? 'opacity-50' : ''
  }`}>
    <span className="text-4xl">{item.image}</span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-sm">{item.name}</h3>
        {!item.available && (
          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
            Unavailable
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
      <p className="text-sm font-bold text-primary mt-1">₹{item.price}</p>
    </div>
    <div>
      {!item.available ? (
        <Button size="sm" variant="outline" disabled className="opacity-50">
          Unavailable
        </Button>
      ) : quantity === 0 ? (
        <Button size="sm" variant="outline" onClick={onAdd} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={onRemove} className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80">
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-sm font-bold w-4 text-center">{quantity}</span>
          <button onClick={onAdd} className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Plus className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  </div>
);

export default MenuPage;
