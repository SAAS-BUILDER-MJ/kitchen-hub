import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type OrderStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED';

export interface CartItem {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  emoji: string;
  quantity: number;
}

interface AuthState {
  role: 'chef' | 'admin' | null;
  isAuthenticated: boolean;
  userId: string | null;
}

interface AppStore {
  // Cart (client-side only)
  cart: CartItem[];
  tableNumber: number;
  tableId: string | null;
  restaurantId: string;
  addToCart: (item: { id: string; name: string; price: number; emoji: string | null }) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  setTableNumber: (table: number) => void;
  setTableId: (id: string) => void;

  // Auth
  auth: AuthState;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;

  // Notifications
  newOrderCount: number;
  incrementNewOrderCount: () => void;
  resetNewOrderCount: () => void;
}

const DEMO_RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';

export const useStore = create<AppStore>((set, get) => ({
  cart: [],
  tableNumber: 1,
  tableId: null,
  restaurantId: DEMO_RESTAURANT_ID,

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
      return {
        cart: [...state.cart, {
          id: item.id,
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          emoji: item.emoji || '🍽️',
          quantity: 1,
        }],
      };
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
  setTableId: (id) => set({ tableId: id }),

  auth: { role: null, isAuthenticated: false, userId: null },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return false;

    // Check role from user_roles table
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id);

    const role = roles?.[0]?.role as 'chef' | 'admin' | null;
    set({ auth: { role, isAuthenticated: true, userId: data.user.id } });
    return true;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ auth: { role: null, isAuthenticated: false, userId: null } });
  },

  checkAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      set({ auth: { role: null, isAuthenticated: false, userId: null } });
      return;
    }
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);

    const role = roles?.[0]?.role as 'chef' | 'admin' | null;
    set({ auth: { role, isAuthenticated: true, userId: session.user.id } });
  },

  newOrderCount: 0,
  incrementNewOrderCount: () => set((state) => ({ newOrderCount: state.newOrderCount + 1 })),
  resetNewOrderCount: () => set({ newOrderCount: 0 }),
}));
