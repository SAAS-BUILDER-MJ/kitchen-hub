import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { fetchOrder, cancelOrder, subscribeToOrder, DbOrder } from '@/lib/supabase-api';
import { CheckCircle2, XCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const GRACE_PERIOD_MS = 60_000; // 60 seconds

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { tableNumber } = useStore();
  const [order, setOrder] = useState<DbOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const loadOrder = useCallback(() => {
    if (orderId) {
      fetchOrder(orderId).then(setOrder).catch(() => {}).finally(() => setLoading(false));
    }
  }, [orderId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  // Real-time updates
  useEffect(() => {
    if (!orderId) return;
    return subscribeToOrder(orderId, loadOrder);
  }, [orderId, loadOrder]);

  // Grace period countdown
  useEffect(() => {
    if (!order) return;
    const elapsed = Date.now() - new Date(order.created_at).getTime();
    const remaining = Math.max(0, Math.ceil((GRACE_PERIOD_MS - elapsed) / 1000));
    setSecondsLeft(remaining);

    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [order]);

  const handleCancel = async () => {
    if (!orderId || !order || order.status !== 'NEW') return;
    setCancelling(true);
    try {
      await cancelOrder(orderId, 'customer', 'Cancelled by customer within grace period');
      toast.success('Order cancelled successfully');
      loadOrder();
    } catch {
      toast.error('Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center p-4"><p>Loading...</p></div>;
  if (!order) return <div className="min-h-screen flex items-center justify-center p-4"><p>Order not found</p></div>;

  const isCancelled = order.status === 'CANCELLED';
  const canCancel = order.status === 'NEW' && secondsLeft > 0 && !isCancelled;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center animate-slide-up">
        {isCancelled ? (
          <>
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-destructive/10 mb-6">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Order Cancelled</h1>
            <p className="text-muted-foreground mb-6">Your order has been cancelled.</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-accent/10 mb-6">
              <CheckCircle2 className="h-10 w-10 text-accent" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
            <p className="text-muted-foreground mb-6">Your order has been sent to the kitchen</p>
          </>
        )}

        <div className="bg-card rounded-lg border p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
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

        {/* Grace period cancellation */}
        {canCancel && (
          <div className="mb-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium mb-2">
              Cancel within {secondsLeft}s
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleCancel}
              disabled={cancelling}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {!isCancelled && (order.status === 'NEW' || order.status === 'PREPARING') && (
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={() => navigate(`/modify-order/${order.id}`)}
            >
              <Pencil className="h-4 w-4" />
              Modify Order
            </Button>
          )}
          {!isCancelled && (
            <Button className="w-full" onClick={() => navigate(`/order-status/${order.id}`)}>
              Track Order
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={() => navigate(`/menu?table=${tableNumber}`)}>
            {isCancelled ? 'Back to Menu' : 'Order More'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
