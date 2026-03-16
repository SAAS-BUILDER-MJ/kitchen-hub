import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { placeOrder as placeOrderApi } from '@/lib/supabase-api';
import { saveOrderForTracking } from '@/components/customer/OrderTracker';
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CartPage = () => {
  const navigate = useNavigate();
  const { cart, tableNumber, tableId, restaurantId, updateQuantity, clearCart } = useStore();
  const [placing, setPlacing] = useState(false);

  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!tableId) {
      toast.error('Table not found. Please scan the QR code again.');
      return;
    }
    setPlacing(true);
    try {
      const order = await placeOrderApi(
        restaurantId,
        tableId,
        tableNumber,
        cart.map((c) => ({ menu_item_id: c.menu_item_id, name: c.name, quantity: c.quantity, price: c.price }))
      );
      clearCart();
      navigate(`/order-confirmation/${order.id}`);
    } catch (err) {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <span className="text-6xl mb-4">🛒</span>
        <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6 text-center">Add some delicious items from the menu</p>
        <Button onClick={() => navigate(`/menu?table=${tableNumber}`)}>Browse Menu</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Your Cart</h1>
            <p className="text-xs text-muted-foreground">Table {tableNumber}</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {cart.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-4 bg-card rounded-lg border">
            <span className="text-3xl">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">{item.name}</h3>
              <p className="text-sm font-bold text-primary">₹{item.price * item.quantity}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center"
              >
                {item.quantity === 1 ? <Trash2 className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3" />}
              </button>
              <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">₹{total}</span>
          </div>
          <Button className="w-full py-6 text-base font-semibold" onClick={handlePlaceOrder} disabled={placing}>
            {placing ? 'Placing Order...' : `Place Order · ₹${total}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
