/**
 * Browser Notification API wrapper for order status changes.
 */

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export function sendOrderNotification(title: string, body: string, tag?: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/placeholder.svg',
      tag: tag || `order-${Date.now()}`,
      requireInteraction: false,
    });
  } catch {
    // Fallback: some browsers don't support Notification constructor
  }
}

export function notifyOrderStatusChange(
  tableNumber: number,
  status: string,
  orderId: string
): void {
  const messages: Record<string, string> = {
    NEW: `New order received from Table ${tableNumber}`,
    PREPARING: `Order for Table ${tableNumber} is being prepared`,
    READY: `Order for Table ${tableNumber} is READY for serving!`,
    SERVED: `Order for Table ${tableNumber} has been served`,
    CANCELLED: `Order for Table ${tableNumber} was cancelled`,
  };

  const msg = messages[status] || `Table ${tableNumber}: ${status}`;
  sendOrderNotification('Kitchen Hub', msg, `order-${orderId}`);
}
