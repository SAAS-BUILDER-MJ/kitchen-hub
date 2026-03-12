import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { orders, tableNumber } = useStore();
  const order = orders.find((o) => o.orderId === Number(orderId));

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p>Order not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center animate-slide-up">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-accent/10 mb-6">
          <CheckCircle2 className="h-10 w-10 text-accent" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
        <p className="text-muted-foreground mb-6">
          Your order #{order.orderId} has been sent to the kitchen
        </p>

        <div className="bg-card rounded-lg border p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Table</span>
            <span className="font-medium text-foreground">{order.tableNumber}</span>
          </div>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.name} × {item.quantity}</span>
              <span className="font-medium">₹{item.price * item.quantity}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">₹{order.total}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button className="w-full" onClick={() => navigate(`/order-status/${order.orderId}`)}>
            Track Order
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate(`/menu?table=${tableNumber}`)}>
            Order More
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
