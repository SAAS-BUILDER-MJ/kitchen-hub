// Re-export everything from domain modules for backward compatibility
export type { DbMenuItem } from './menu-api';
export { fetchMenuItems, fetchAllMenuItems, fetchCategories, createMenuItem, updateMenuItem, deleteMenuItem } from './menu-api';

export type { OrderStatus, DbOrder, DbOrderItem } from './order-api';
export { generateIdempotencyKey, placeOrder, fetchOrders, fetchOrder, updateOrderStatus, cancelOrder, subscribeToOrders, subscribeToOrder } from './order-api';

export { fetchTable } from './table-api';
