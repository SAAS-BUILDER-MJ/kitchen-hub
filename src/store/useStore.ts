import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

export type OrderStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export interface CartItem {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  emoji: string;
  quantity: number;
  notes: string;
}

interface AuthState {
  role: 'chef' | 'admin' | null;
  isAuthenticated: boolean;
  userId: string | null;
  userRestaurantId: string | null;
}

interface AppStore {
  // Cart
  cart: CartItem[];
  tableNumber: number;
  tableId: string | null;
  restaurantId: string;
  addToCart: (item: { id: string; name: string; price: number; emoji: string | null }) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  clearCart: () => void;
  setTableNumber: (table: number) => void;
  setTableId: (id: string) => void;
  setRestaurantId: (id: string) => void;

  // Auth (not persisted)
  auth: AuthState;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  initAuthListener: () => { data: { subscription: { unsubscribe: () => void } } };

  // Notifications
  newOrderCount: number;
  incrementNewOrderCount: () => void;
  resetNewOrderCount: () => void;
}

const DEMO_RESTAURANT_ID = 'b1000000-0000-0000-0000-000000000001';

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
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
              notes: '',
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

      updateItemNotes: (itemId, notes) =>
        set((state) => ({
          cart: state.cart.map((c) => (c.id === itemId ? { ...c, notes } : c)),
        })),

      clearCart: () => set({ cart: [] }),
      setTableNumber: (table) => set({ tableNumber: table }),
      setTableId: (id) => set({ tableId: id }),
      setRestaurantId: (id) => set({ restaurantId: id }),

      auth: { role: null, isAuthenticated: false, userId: null, userRestaurantId: null },
      authLoading: true,

      login: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) return false;

        // Fetch role to validate staff access (listener will also update state)
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role, restaurant_id')
          .eq('user_id', data.user.id);

        const role = roles?.[0]?.role as 'chef' | 'admin' | null;
        if (!role) {
          await supabase.auth.signOut();
          return false;
        }

        const userRestaurantId = (roles?.[0] as any)?.restaurant_id || null;
        set({ auth: { role, isAuthenticated: true, userId: data.user.id, userRestaurantId }, authLoading: false });
        return true;
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({ auth: { role: null, isAuthenticated: false, userId: null, userRestaurantId: null } });
      },

      checkAuth: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            set({ auth: { role: null, isAuthenticated: false, userId: null, userRestaurantId: null }, authLoading: false });
            return;
          }
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role, restaurant_id')
            .eq('user_id', session.user.id);

          const role = roles?.[0]?.role as 'chef' | 'admin' | null;
          const userRestaurantId = (roles?.[0] as any)?.restaurant_id || null;
          set({ auth: { role, isAuthenticated: true, userId: session.user.id, userRestaurantId }, authLoading: false });
        } catch (err) {
          console.error('[checkAuth] failed:', err);
          set({ auth: { role: null, isAuthenticated: false, userId: null, userRestaurantId: null }, authLoading: false });
        }
      },

      initAuthListener: () => {
        return supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' || !session?.user) {
            set({ auth: { role: null, isAuthenticated: false, userId: null, userRestaurantId: null }, authLoading: false });
            return;
          }
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            // Fire-and-forget: never await inside onAuthStateChange to avoid deadlocks
            supabase
              .from('user_roles')
              .select('role, restaurant_id')
              .eq('user_id', session.user.id)
              .then(({ data: roles }) => {
                const role = roles?.[0]?.role as 'chef' | 'admin' | null;
                const userRestaurantId = (roles?.[0] as any)?.restaurant_id || null;
                set({ auth: { role, isAuthenticated: true, userId: session.user.id, userRestaurantId }, authLoading: false });
              });
          }
        });
      },

      newOrderCount: 0,
      incrementNewOrderCount: () => set((state) => ({ newOrderCount: state.newOrderCount + 1 })),
      resetNewOrderCount: () => set({ newOrderCount: 0 }),
    }),
    {
      name: 'kitchen-hub-store',
      partialize: (state) => ({
        cart: state.cart,
        tableNumber: state.tableNumber,
        tableId: state.tableId,
        restaurantId: state.restaurantId,
      }),
    }
  )
);
