import { create } from 'zustand';
import menuData from '@/data/menu.json';

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image: string;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export type OrderStatus = 'NEW' | 'PREPARING' | 'READY';

export interface Order {
  orderId: number;
  tableNumber: number;
  items: { name: string; quantity: number; price: number }[];
  status: OrderStatus;
  total: number;
  createdAt: string;
}

interface AuthState {
  role: 'customer' | 'chef' | 'admin' | null;
  isAuthenticated: boolean;
}

interface AppStore {
  // Menu
  menu: MenuItem[];

  // Cart
  cart: CartItem[];
  tableNumber: number;
  addToCart: (item: MenuItem) => void;
  removeFromCart: (itemId: number) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  clearCart: () => void;
  setTableNumber: (table: number) => void;

  // Orders
  orders: Order[];
  placeOrder: () => Order | null;
  updateOrderStatus: (orderId: number, status: OrderStatus) => void;
  getOrdersByTable: (table: number) => Order[];

  // Auth
  auth: AuthState;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

let nextOrderId = 101;

export const useStore = create<AppStore>((set, get) => ({
  menu: menuData as MenuItem[],

  cart: [],
  tableNumber: 1,

  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.id === item.id);
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
          ),
        };
      }
      return { cart: [...state.cart, { ...item, quantity: 1 }] };
    }),

  removeFromCart: (itemId) =>
    set((state) => ({ cart: state.cart.filter((c) => c.id !== itemId) })),

  updateQuantity: (itemId, quantity) =>
    set((state) => {
      if (quantity <= 0) return { cart: state.cart.filter((c) => c.id !== itemId) };
      return {
        cart: state.cart.map((c) => (c.id === itemId ? { ...c, quantity } : c)),
      };
    }),

  clearCart: () => set({ cart: [] }),

  setTableNumber: (table) => set({ tableNumber: table }),

  orders: [],

  placeOrder: () => {
    const { cart, tableNumber } = get();
    if (cart.length === 0) return null;
    const order: Order = {
      orderId: nextOrderId++,
      tableNumber,
      items: cart.map((c) => ({ name: c.name, quantity: c.quantity, price: c.price })),
      status: 'NEW',
      total: cart.reduce((sum, c) => sum + c.price * c.quantity, 0),
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ orders: [...state.orders, order], cart: [] }));
    return order;
  },

  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.orderId === orderId ? { ...o, status } : o
      ),
    })),

  getOrdersByTable: (table) => get().orders.filter((o) => o.tableNumber === table),

  auth: { role: null, isAuthenticated: false },

  login: (username, password) => {
    if (username === 'chef' && password === 'chef123') {
      set({ auth: { role: 'chef', isAuthenticated: true } });
      return true;
    }
    if (username === 'admin' && password === 'admin123') {
      set({ auth: { role: 'admin', isAuthenticated: true } });
      return true;
    }
    return false;
  },

  logout: () => set({ auth: { role: null, isAuthenticated: false } }),
}));
