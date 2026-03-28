import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useStore, OrderStatus } from '@/store/useStore';
import { fetchOrder, subscribeToOrder, DbOrder } from '@/lib/supabase-api';
import { ArrowLeft, Clock, ChefHat, CheckCircle2, UtensilsCrossed, XCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusConfig: Record<OrderStatus, { icon: React.ReactNode; label: string; color: string; description: string }> = {
  NEW: { icon: <Clock className="h-6 w-6" />, label: 'Order Received', color: 'text-warning bg-warning/10', description: 'Your order has been received and is waiting to be prepared' },
  PREPARING: { icon: <ChefHat className="h-6 w-6" />, label: 'Preparing', color: 'text-primary bg-primary/10', description: 'The kitchen is preparing your order' },
  READY: { icon: <CheckCircle2 className="h-6 w-6" />, label: 'Ready!', color: 'text-accent bg-accent/10', description: 'Your order is ready for pickup!' },
  SERVED: { icon: <UtensilsCrossed className="h-6 w-6" />, label: 'Served', color: 'text-success bg-success/10', description: 'Your order has been served. Enjoy your meal!' },
  CANCELLED: { icon: <XCircle className="h-6 w-6" />, label: 'Cancelled', color: 'text-destructive bg-destructive/10', description: 'This order has been cancelled.' },
};

const steps: OrderStatus[] = ['NEW', 'PREPARING', 'READY', 'SERVED'];

const OrderStatusPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { tableNumber } = useStore();
  const [order, setOrder] = useState<DbOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = () => {
    if (orderId) {
      fetchOrder(orderId).then(setOrder).catch(() => {}).finally(() => setLoading(false));
    }
  };

  useEffect(() => { loadOrder(); }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const unsub = subscribeToOrder(orderId, loadOrder);
    return unsub;
  }, [orderId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  if (!order) return <div className="min-h-screen flex items-center justify-center"><p>Order not found</p></div>;

  const isCancelled = order.status === 'CANCELLED';
  const config = statusConfig[order.status];
  const currentStep = isCancelled ? -1 : steps.indexOf(order.status);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(`/menu?table=${tableNumber}`)} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Order Status</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8 animate-slide-up">
          <div className={`inline-flex items-center justify-center h-16 w-16 rounded-full ${config.color} mb-4`}>
            {config.icon}
          </div>
          <h2 className="text-2xl font-bold mb-1">{config.label}</h2>
          <p className="text-muted-foreground text-sm">{config.description}</p>
        </div>

        {!isCancelled && (
          <>
            <div className="flex items-center justify-center gap-0 mb-8">
              {steps.map((step, i) => {
                const done = i <= currentStep;
                return (
                  <div key={step} className="flex items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      done ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    }`}>{i + 1}</div>
                    {i < steps.length - 1 && (
                      <div className={`w-8 sm:w-16 h-1 ${i < currentStep ? 'bg-primary' : 'bg-secondary'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between mb-8 px-2">
              {steps.map((step, i) => (
                <span key={step} className={`text-[10px] sm:text-xs text-center ${i <= currentStep ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {step}
                </span>
              ))}
            </div>
          </>
        )}

        {isCancelled && order.cancel_reason && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-6 text-center">
            <p className="text-sm text-destructive">Reason: {order.cancel_reason}</p>
          </div>
        )}

        <div className="bg-card rounded-lg border p-4 space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">Order Details</h3>
          <div className="text-sm text-muted-foreground flex justify-between">
            <span>Table</span>
            <span className="font-medium text-foreground">{order.table_number}</span>
          </div>
          {order.items?.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between text-sm">
                <span>{item.name} × {item.quantity}</span>
                <span className="font-medium">₹{item.price * item.quantity}</span>
              </div>
              {item.notes && (
                <p className="text-xs text-muted-foreground italic ml-2">📝 {item.notes}</p>
              )}
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">₹{order.total_price}</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          This page updates automatically in real-time.
        </p>

        {!isCancelled && (order.status === 'NEW' || order.status === 'PREPARING') && (
          <Button
            variant="secondary"
            className="w-full mt-4 gap-2"
            onClick={() => navigate(`/modify-order/${order.id}`)}
          >
            <Pencil className="h-4 w-4" />
            Modify Order
          </Button>
        )}

        <Button variant="outline" className="w-full mt-4" onClick={() => navigate(`/menu?table=${tableNumber}`)}>
          Back to Menu
        </Button>
      </div>
    </div>
  );
};

export default OrderStatusPage;
