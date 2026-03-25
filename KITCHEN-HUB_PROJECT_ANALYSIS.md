# Kitchen Hub Project Analysis (Frontend + Supabase)

This document is based only on what’s present in the repository at `/Users/trux/SAAS/kitchen-hub`.

## 1. Project Overview

### Exact purpose

The app is a QR-table restaurant ordering system where:

1. A customer opens a table-specific menu route (`/menu?table={tableNumber}`).
2. The customer builds a cart locally in the browser.
3. The customer places an order, which inserts rows into Supabase tables (`orders`, then `order_items`).
4. The kitchen and admins view/update order status in real time via Supabase Realtime subscriptions.
5. Customers track their own orders in real time using order IDs persisted in `localStorage`.

Project UX copy and route usage:

- Landing page: `src/pages/Index.tsx` (“QR Restaurant”, buttons navigate to `/menu?table=5`, `/login` for staff).
- Customer ordering routes: `src/pages/MenuPage.tsx`, `src/pages/CartPage.tsx`, `src/pages/OrderConfirmation.tsx`, `src/pages/OrderStatusPage.tsx`.
- Staff dashboards: `src/pages/KitchenDashboard.tsx` (chef) and `src/pages/AdminDashboard.tsx` (admin).

### Real-world problem it solves (as evidenced by code)

Digitizes a “table ordering + kitchen workflow” without requiring a separate backend server in this repo:

- Menu browsing by table number (`MenuPage` reads `table` from query params and fetches `tables.id`).
- Real-time order lifecycle management (kitchen updates status; customer/admin see changes through Supabase Realtime).

### Target users (as evidenced by code)

- Customers (unauthenticated): can access `/`, `/menu`, `/cart`, `/order-confirmation/:orderId`, `/order-status/:orderId` without any staff authentication.
- Staff (authenticated): can sign in on `/login` and are role-routed into:
  - Chef: `/kitchen` (requires `auth.role === "chef"`).
  - Admin: `/admin` (requires `auth.role === "admin"`).

### Not found in codebase (important gaps)

- QR code scanning UI/implementation is not found in the frontend code. The only table entry mechanism implemented is the URL route `/menu?table={n}`. (The DB does contain a `qr_code` column in `supabase/migrations/20260314053001_14fe32a9-49f0-4816-b46d-444c65e85994.sql`, but it is not used by the frontend.)
- Multi-restaurant switching is not found. The frontend hardcodes `DEMO_RESTAURANT_ID` in `src/lib/supabase-api.ts` and `src/store/useStore.ts`.
- Customer account creation / OAuth is not found. Only staff email/password sign-in is implemented (`supabase.auth.signInWithPassword` in `src/pages/LoginPage.tsx` and `src/store/useStore.ts`).
- Any payments, refunds, printing, or waiter role flows are not found.

## 2. Tech Stack Identification (from actual files)

### Frontend

- React 18 + TypeScript
- Vite (`vite.config.ts`) and Vite dev/build scripts in `package.json`
- React Router (`src/App.tsx`) for routing
- Tailwind CSS + shadcn/ui components (`src/components/ui/*`)
- State management: Zustand (`src/store/useStore.ts`)
- Data/state synchronization: TanStack React Query is used at app level (`QueryClientProvider` in `src/App.tsx`), but the project’s Supabase reads are mostly done with direct async calls (not React Query hooks).
- Charts: Recharts (`src/components/admin/AdminOverviewTab.tsx`)
- Realtime: Supabase Realtime via `supabase-js` channels (see `src/lib/supabase-api.ts`)

### Backend (in this repo)

There is no separate Node/Express backend server in this repository.

The “backend” is Supabase:

- Supabase client: `src/integrations/supabase/client.ts`
- Supabase API helpers: `src/lib/supabase-api.ts` (all DB reads/writes and realtime subscriptions)
- DB schema + RLS: `supabase/migrations/*.sql`

### Database

- PostgreSQL schema managed by Supabase migrations in `supabase/migrations/*.sql`

### External APIs / services

- Supabase (`@supabase/supabase-js`) using:
  - Auth: `supabase.auth.signInWithPassword`, `supabase.auth.signOut`, `supabase.auth.getSession`
  - Postgres queries: `.from(...).select/insert/update`
  - Realtime channels: `.channel(...).on('postgres_changes', ...)`

### Authentication mechanism

- Staff auth uses Supabase email/password:
  - `supabase.auth.signInWithPassword({ email, password })` (`src/pages/LoginPage.tsx`)
  - Session retrieval: `supabase.auth.getSession()` (`src/store/useStore.ts`)
  - Sign-out: `supabase.auth.signOut()` (`src/pages/LoginPage.tsx`, `src/store/useStore.ts`)

### Role source

- Staff roles are stored in the `public.user_roles` table.
- Staff login checks `user_roles` by `user_id`:
  - `src/pages/LoginPage.tsx` and `src/store/useStore.ts`

## 3. Architecture

### Architecture type

Hybrid:

- Frontend: single Vite React SPA
- Backend/DB: Supabase Postgres + Supabase Realtime + Supabase RLS

### Folder structure (major parts and purpose)

- `src/App.tsx`: React Router routes + staff route protection logic.
- `src/pages/*`: route-level screens
  - `Index.tsx`: landing/entry
  - `MenuPage.tsx`: menu display + category/search + cart entry + order tracking widget
  - `CartPage.tsx`: cart UI + “place order”
  - `OrderConfirmation.tsx`: post-order summary + customer grace-period cancellation UI
  - `OrderStatusPage.tsx`: order progress UI (real-time)
  - `LoginPage.tsx`: staff login
  - `KitchenDashboard.tsx`: chef dashboard (status updates + cancellation + dish grouping)
  - `AdminDashboard.tsx`: admin dashboard (analytics + order list + menu management)
  - `PRDDownload.tsx`: generates and downloads a `.docx` PRD document in the browser
- `src/lib/supabase-api.ts`: all Supabase queries/mutations + realtime subscriptions.
- `src/integrations/supabase/client.ts`: Supabase client configuration.
- `src/store/useStore.ts`: Zustand store (cart state + staff auth state).
- `src/components/customer/OrderTracker.tsx`: customer “My Orders” widget (localStorage + realtime).
- `src/components/admin/*`: admin tabs/components.
- `supabase/migrations/*`: schema, triggers, enums, and RLS policies.

### Data flow (Frontend → Backend → DB → Response)

All DB interactions happen via:

1. Frontend function calls in `src/lib/supabase-api.ts`
2. Supabase Postgres queries/mutations
3. Postgres returns rows to the frontend (or errors)
4. Frontend updates local state and UI

Concrete examples:

- Place order:
  - `CartPage.tsx` calls `placeOrder` (`src/lib/supabase-api.ts`)
  - `placeOrder` inserts into `orders` then inserts into `order_items`
- Kitchen updates status:
  - `KitchenDashboard.tsx` calls `updateOrderStatus` (Supabase update on `orders`)
- Kitchen cancels order:
  - `KitchenDashboard.tsx` calls `cancelOrder` (Supabase update on `orders`)
- Customer tracking:
  - `OrderTracker.tsx` fetches `orders` by IDs and subscribes to `orders` realtime changes

### API communication flow with real examples

Logical “API endpoints” are the exported functions from `src/lib/supabase-api.ts`:

- `fetchMenuItems(...)` → `supabase.from('menu_items').select('*, menu_categories(name)')`
- `fetchCategories(...)` → `supabase.from('menu_categories').select('*')`
- `createMenuItem(...)` → `supabase.from('menu_items').insert(...).select().single()`
- `updateMenuItem(...)` → `supabase.from('menu_items').update(updates).eq('id', id)`
- `deleteMenuItem(id)` → `supabase.from('menu_items').update({ is_deleted: true, deleted_at: ... }).eq('id', id)`
- `fetchTable(restaurantId, tableNumber)` → `supabase.from('tables').select('*').eq('restaurant_id', ...).eq('table_number', ...).single()`
- `placeOrder(...)`
  - Insert order: `supabase.from('orders').insert(...).select().single()`
  - Insert line items: `supabase.from('order_items').insert(orderItems)`
- `fetchOrders(...)` → `supabase.from('orders').select('*, order_items(*)')...`
- `fetchOrder(orderId)` → `supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single()`
- `updateOrderStatus(orderId, status)` → `supabase.from('orders').update({ status }).eq('id', orderId)`
- `cancelOrder(orderId, cancelledBy, reason)` → `supabase.from('orders').update({ status: 'CANCELLED', cancelled_by, cancel_reason }).eq('id', orderId)`
- Realtime subscriptions:
  - `subscribeToOrders(restaurantId, callback)` subscribes to `orders` with `filter: restaurant_id=eq.${restaurantId}`
  - `subscribeToOrder(orderId, callback)` subscribes to `orders` with `event: 'UPDATE'` and `filter: id=eq.${orderId}`

## 4. User Roles & Permissions

### Roles found in code

1. `chef`
2. `admin`

In Supabase schema, `public.app_role` enum includes also:

3. `user`

However, `user` is not routed into any frontend dashboard and staff login is explicitly cast to `chef | admin | null`.

### How authorization is enforced (frontend)

- `src/App.tsx` implements role-based routing using Zustand store:
  - `/kitchen`: `ProtectedRoute role="chef"`; checks `auth.isAuthenticated` and `auth.role === role`
  - `/admin`: `ProtectedRoute role="admin"`; checks `auth.isAuthenticated` and `auth.role === role`
  - `/dashboard`: `StaffRouter` routes based on `auth.role` (chef → `KitchenDashboard`, admin → `AdminDashboard`)

Relevant code:

- `ProtectedRoute` in `src/App.tsx`
- `StaffRouter` in `src/App.tsx`
- Auth initialization: `AuthInit` calls `checkAuth()` on mount

### How authorization is enforced (backend: RLS policies)

RLS policies are defined in `supabase/migrations/20260314053001_14fe32a9-49f0-4816-b46d-444c65e85994.sql` and modified by later migrations.

Key RLS policy facts:

1. Staff ability to update orders
   - `public.orders FOR UPDATE` is restricted to authenticated users that satisfy `has_role(auth.uid(), 'chef'/'admin') OR has_restaurant_role(auth.uid(),'chef'/'admin', restaurant_id)`
   - See migration `supabase/migrations/20260315043510_65d02910-ebcb-400d-bf1a-6222177c4ac5.sql`
2. Public insert/select on orders and order_items
   - `public.orders FOR INSERT` is allowed (with a check that `restaurant_id` exists)
   - `public.orders FOR SELECT` is allowed for anyone
   - `public.order_items FOR INSERT` is allowed (with a check that `order_id` exists)
   - `public.order_items FOR SELECT` is allowed for anyone
3. Menu data is public read; menu management requires admin staff
   - `public.menu_items FOR SELECT` is public
   - `public.menu_items FOR ALL` to authenticated users is restricted using `has_restaurant_role(auth.uid(), 'admin', restaurant_id)`
4. Tables and categories are public read
   - `public.tables FOR SELECT` is public
   - `public.menu_categories FOR SELECT` is public

### Role-by-role permission summary (as actually enforced)

#### Chef

- Frontend:
  - Can only access `/kitchen` (and `/dashboard` via `StaffRouter`).
  - Kitchen can advance order statuses via `updateOrderStatus`.
  - Kitchen can cancel orders via `cancelOrder` with `cancelled_by: 'staff'`.
- Backend (Supabase):
  - Can update orders (`FOR UPDATE`) if RLS `USING` condition passes:
    - `has_role(auth.uid(),'chef')` OR `has_restaurant_role(auth.uid(),'chef', restaurant_id)`

#### Admin

- Frontend:
  - Can only access `/admin` (and `/dashboard` via `StaffRouter`).
  - Can view analytics (overview/orders/menu tabs).
  - Can add/edit/toggle/delete menu items via `createMenuItem`, `updateMenuItem`, `deleteMenuItem`.
  - Can view orders (read-only in the UI; no update UI exists for admin orders tab).
- Backend (Supabase):
  - Can update orders (`FOR UPDATE`) if RLS passes for admin.
  - Can manage menu categories/menu items (RLS uses `has_restaurant_role(auth.uid(), 'admin', restaurant_id)` for menu tables).

#### User (Supabase enum exists, but frontend behavior differs)

- Backend:
  - No explicit RLS policies were found that grant `user` any order-update capabilities.
  - The `orders FOR UPDATE` policy explicitly checks for chef/admin roles.
- Frontend:
  - Staff login casts role to `chef | admin | null`.
  - If a role assignment is `user`, login will treat it as not a supported staff role and sets the error:
    - `setError('No staff role assigned to this account')` and then `supabase.auth.signOut()`

## 5. Features & Functionalities

All features below are present in the codebase.

### Public customer ordering

#### Table Menu (route + table assignment)

- Implemented in: `src/pages/MenuPage.tsx`
- Inputs:
  - `table` query param, read via `useSearchParams()`
- Internal steps:
  1. If `table` exists, parse as int and call `fetchTable(DEMO_RESTAURANT_ID, num)` to get `tables.id`.
  2. Store:
     - `setTableNumber(num)` in Zustand
     - `setTableId(t.id)` in Zustand
  3. Fetch menu data:
     - `fetchMenuItems()` and `fetchCategories()`
  4. Render UI with:
     - category filtering (`activeCategory`)
     - search filtering (`searchQuery`)
     - add/remove cart buttons
     - item disabled state if `item.available === false`
     - order tracking widget: `<OrderTracker tableNumber={tableNumber} />`
  5. Render fixed “View Cart” CTA including computed subtotal.

#### Cart + Order placement

- Implemented in: `src/pages/CartPage.tsx`
- Internal steps for placing an order:
  1. Validate `tableId` exists, else `toast.error('Table not found...')` and return.
  2. Call `placeOrderApi(restaurantId, tableId, tableNumber, cartItems)` from `src/lib/supabase-api.ts`.
  3. On success:
     - `saveOrderForTracking(order.id)` in `src/components/customer/OrderTracker.tsx`
     - `clearCart()` in Zustand
     - navigate to `/order-confirmation/${order.id}`

#### Order confirmation + grace-period cancellation UI

- Implemented in: `src/pages/OrderConfirmation.tsx`
- Internal steps:
  1. Load order via `fetchOrder(orderId)` from `src/lib/supabase-api.ts`
  2. Subscribe to order updates via `subscribeToOrder(orderId, loadOrder)`
  3. Compute grace countdown:
     - `GRACE_PERIOD_MS = 60_000`
     - `secondsLeft = ceil((GRACE_PERIOD_MS - elapsedMs)/1000)`
  4. Show “Cancel Order” button only if:
     - `order.status === 'NEW'`
     - `secondsLeft > 0`
     - not already cancelled
  5. On cancel:
     - call `cancelOrder(orderId, 'customer', 'Cancelled by customer within grace period')`

#### Order status tracking (real-time)

- Implemented in: `src/pages/OrderStatusPage.tsx`
- Internal steps:
  1. Load order via `fetchOrder(orderId)`
  2. Subscribe to realtime updates via `subscribeToOrder(orderId, loadOrder)`
  3. Render step UI for statuses:
     - NEW → PREPARING → READY → SERVED
     - CANCELLED uses a separate cancelled configuration and hides steps
  4. Show cancel reason when available.

#### Customer “My Orders” floating widget

- Implemented in: `src/components/customer/OrderTracker.tsx`
- Storage mechanism:
  - Order IDs are persisted in `localStorage` under `ORDER_STORAGE_KEY = 'customer_order_ids'`.
  - Order IDs are added by `saveOrderForTracking(order.id)` in `CartPage.tsx`.
- Internal steps:
  1. `loadOrders()`:
     - read tracked order IDs from localStorage
     - query `orders` for those IDs with `select('*, order_items(*)')`
     - filter out `SERVED` and `CANCELLED`
     - set state `orders`
     - cleanup localStorage to keep only active order IDs
  2. Subscribe to realtime changes:
     - `subscribeToOrders(DEMO_RESTAURANT_ID, loadOrders)` which listens to all events on `public.orders`

Important discrepancy:

- The PRD content (`src/pages/PRDDownload.tsx`) claims order IDs are stored per table, but the actual code uses a single key `customer_order_ids` without table scoping.

### Staff ordering workflows

#### Kitchen Dashboard (Chef)

- Implemented in: `src/pages/KitchenDashboard.tsx`
- Role gate:
  - Route `/kitchen` uses `ProtectedRoute role="chef"` in `src/App.tsx`.
- Internal steps:
  1. `loadOrders()`:
     - `fetchOrders()` from `src/lib/supabase-api.ts` (select orders + order_items for `DEMO_RESTAURANT_ID`)
     - counts number of `NEW` orders
     - if count increases, plays an audio notification via Web Audio API (in code guarded by `try/catch {}`).
  2. Subscribe to realtime order changes:
     - `subscribeToOrders(DEMO_RESTAURANT_ID, loadOrders)`
  3. Compute view lists:
     - `activeOrders` excludes `SERVED` and `CANCELLED` and sorts by `created_at` ascending
     - `displayed` applies filter `ALL | NEW | PREPARING | READY`
  4. Optional dish grouping:
     - enabled by `showDishGrouping`
     - groups dish names for orders with status NEW/PREPARING
     - only shows groups present in more than one order
  5. Status management:
     - Cancel dialog opens when order.status is `NEW` or `PREPARING`
     - Cancel calls `cancelOrder(order.id,'staff', reason)`
     - Status advance buttons use `nextStatus` mapping:
       - NEW → PREPARING
       - PREPARING → READY
       - READY → SERVED
       - CANCELLED and SERVED have no next state

#### Admin Dashboard (Admin)

- Implemented in: `src/pages/AdminDashboard.tsx`
- Role gate:
  - Route `/admin` uses `ProtectedRoute role="admin"`.
- Internal steps:
  1. Tabs:
     - `overview`, `orders`, `menu`
  2. Data loading:
     - `fetchMenuItems()`, `fetchCategories()`, `fetchOrders()` in parallel.
  3. Date filtering:
     - date range presets + custom date via `src/components/admin/AdminDateFilter.tsx`
     - filters orders by `created_at` (client-side only)
  4. Overview metrics:
     - revenue and avg values are computed only from `SERVED`
     - status breakdown and cancelled counts use all statuses in the filtered set
     - popular items are computed from all order items in the filtered set (no status filter in code).
  5. Orders tab:
     - search (table number substring or item name substring)
     - status filter (including CANCELLED)
     - sort toggle newest/oldest
     - CSV export created in-browser
  6. Menu tab:
     - add/edit via dialog
     - toggle availability
     - delete is a soft delete via `deleteMenuItem` (sets `is_deleted: true`)

### Admin “PRD Download”

- Implemented in: `src/pages/PRDDownload.tsx`
- Feature:
  - Generates a `.docx` document using `docx` and downloads it via `file-saver`.
  - Auto-downloads on mount (`useEffect` calls `handleDownload()`).

## 6. Backend Logic

### API endpoints (method + route)

There are no HTTP API endpoints (no Express/Fastify/etc.) in this repository.

Instead, the “API” is Supabase queries executed by the frontend.

All Supabase read/write entrypoints are the exported functions from `src/lib/supabase-api.ts`:

1. Menu/category APIs
   - `fetchMenuItems(restaurantId?)` (Supabase SELECT from `menu_items`)
   - `fetchAllMenuItems(restaurantId?)` (Supabase SELECT from `menu_items`, no `is_deleted` filter)
   - `fetchCategories(restaurantId?)` (Supabase SELECT from `menu_categories`)
   - `createMenuItem(...)` (Supabase INSERT into `menu_items`)
   - `updateMenuItem(id, updates)` (Supabase UPDATE on `menu_items`)
   - `deleteMenuItem(id)` (soft UPDATE on `menu_items`)
2. Tables
   - `fetchTable(restaurantId, tableNumber)` (Supabase SELECT from `tables`)
3. Orders
   - `placeOrder(restaurantId, tableId, tableNumber, items)`:
     - INSERT into `orders`
     - INSERT into `order_items`
   - `fetchOrders(restaurantId?)` (SELECT from `orders` + nested `order_items(*)`)
   - `fetchOrder(orderId)` (SELECT from `orders` + nested `order_items(*)`, single row)
   - `updateOrderStatus(orderId, status)` (UPDATE `orders.status`)
   - `cancelOrder(orderId, cancelledBy, reason?)` (UPDATE `orders` to status CANCELLED with cancel metadata)
4. Realtime subscriptions
   - `subscribeToOrders(restaurantId, callback)`:
     - channel `orders-realtime`
     - `postgres_changes` with `event: '*'` on `public.orders`
     - filter `restaurant_id=eq.${restaurantId}`
   - `subscribeToOrder(orderId, callback)`:
     - channel `order-${orderId}`
     - `postgres_changes` with `event: 'UPDATE'` on `public.orders`
     - filter `id=eq.${orderId}`

### Business logic breakdown (request → processing → response)

Example: place order

1. `CartPage.tsx` calls `placeOrderApi` with cart items and table info from Zustand.
2. `src/lib/supabase-api.ts` computes:
   - `totalPrice = items.reduce(...)`
3. It inserts into `orders` with `status` omitted, so DB default `NEW` applies.
4. It inserts each item into `order_items`, storing a snapshot:
   - `name`, `price`, `quantity`, `notes`
5. It returns the inserted order row (`orders` insert `.select().single()`).
6. UI stores `order.id` in localStorage and navigates to confirmation.

### Middleware usage

- Not found in codebase.

All authorization is enforced through Supabase RLS policies (see migrations).

### Error handling patterns

- Supabase helper functions throw errors when `error` is returned by Supabase.
- Callers vary:
  - Some pages catch errors and show `toast.error(...)` (e.g., kitchen status update, cart place order).
  - Some catch errors silently (`catch {}` in multiple `loadData/loadOrders` functions).

## 7. Database Design

Database schema is defined by `supabase/migrations/20260314053001_14fe32a9-49f0-4816-b46d-444c65e85994.sql` and modified by subsequent migrations.

### Enums

- `public.order_status`: enum
  - initial values: `NEW`, `PREPARING`, `READY`, `SERVED`
  - later migration adds: `CANCELLED` (`supabase/migrations/20260317040822_5a74917e-1d0f-49e4-bd95-3a8c6319afd1.sql`)
- `public.app_role`: enum values `admin`, `chef`, `user`

### Tables

#### `public.restaurants`

- Key columns:
  - `id` UUID PK
  - `name`, `description`, `logo_url`, `address`, `phone`
  - timestamps `created_at`, `updated_at`
- RLS enabled
- RLS policies:
  - Public SELECT
  - Admin can manage via `has_restaurant_role(auth.uid(),'admin', id)`

#### `public.tables`

- Key columns:
  - `id` UUID PK
  - `restaurant_id` FK → `restaurants(id)`
  - `table_number` integer (unique per restaurant)
  - `qr_code` text
  - `is_active` boolean
  - timestamps
- RLS enabled
- RLS policies:
  - Public SELECT
  - Admin can manage via `has_restaurant_role(...,'admin', restaurant_id)`

#### `public.menu_categories`

- Key columns:
  - `id` UUID PK
  - `restaurant_id` FK
  - `name`
  - `sort_order`
- RLS enabled
- RLS policies:
  - Public SELECT
  - Admin can manage via `has_restaurant_role(...,'admin', restaurant_id)`

#### `public.menu_items`

- Key columns (initial + later migrations):
  - `id` UUID PK
  - `category_id` FK → `menu_categories(id)`
  - `restaurant_id` FK → `restaurants(id)`
  - `name`, `description`, `price`
  - `image_url` text
  - `emoji` text default '🍽️'
  - `available` boolean default true
  - timestamps
  - later migrations add:
    - `is_deleted` boolean default false
    - `deleted_at` timestamp
    - (soft delete used by frontend)
- RLS enabled
- RLS policies:
  - Public SELECT
  - Admin can manage via `has_restaurant_role(auth.uid(),'admin', restaurant_id)`

#### `public.orders`

- Key columns (initial + later migrations):
  - `id` UUID PK
  - `restaurant_id` FK
  - `table_id` FK → `tables(id)`
  - `table_number` integer
  - `status` order_status default 'NEW'
  - `total_price` numeric
  - timestamps
  - later migrations add:
    - `cancelled_by` text
    - `cancel_reason` text
- RLS enabled
- RLS policies:
  - `FOR INSERT`: allowed with a check that restaurant_id exists
  - `FOR SELECT`: public SELECT
  - `FOR UPDATE`: restricted to authenticated chef/admin via `has_role` and `has_restaurant_role`

#### `public.order_items`

- Key columns (initial + later migrations):
  - `id` UUID PK
  - `order_id` FK → `orders(id)`
  - `menu_item_id` FK → `menu_items(id)`
  - `name`, `quantity`, `price`
  - timestamps
  - later migration adds:
    - `notes` text nullable
- RLS enabled
- RLS policies:
  - `FOR INSERT`: allowed with a check that order_id exists
  - `FOR SELECT`: public SELECT

#### `public.user_roles`

- Key columns:
  - `id` UUID PK
  - `user_id` FK → `auth.users(id)`
  - `restaurant_id` nullable FK → `restaurants(id)`
  - `role` app_role enum
  - timestamps
- RLS enabled
- RLS policies:
  - Users can SELECT their own rows: `user_id = auth.uid()`
  - Admins can manage roles:
    - `public.user_roles FOR ALL` to authenticated
    - `USING (public.has_role(auth.uid(), 'admin'))`

### Relationships

From migrations:

- `restaurants` 1 → many `tables`
- `restaurants` 1 → many `menu_categories`
- `menu_categories` 1 → many `menu_items`
- `restaurants` 1 → many `menu_items`
- `restaurants` 1 → many `orders`
- `tables` 1 → many `orders`
- `orders` 1 → many `order_items`
- `menu_items` 1 → many `order_items`
- `auth.users` 1 → many `user_roles`

### Key queries (identified from frontend code)

- Menu:
  - `src/lib/supabase-api.ts`: `fetchMenuItems` filters by `restaurant_id` and `is_deleted = false`
  - `fetchCategories` orders by `sort_order`
- Orders:
  - `fetchOrders`: `.eq('restaurant_id', DEMO_RESTAURANT_ID).order('created_at', { ascending: false })`
  - `fetchOrder(orderId)`: single row by `id`
- Kitchen filters:
  - `KitchenDashboard.tsx`: client-side filtering by order status
- Customer tracking:
  - `OrderTracker.tsx`: query `.in('id', ids)` and `.not('status','in','("SERVED","CANCELLED")')`

## 8. Frontend State Management

### How state is managed

- Zustand store: `src/store/useStore.ts`
  - cart: `cart[]` (client-side only)
  - tableNumber/tableId: used to place orders and navigate back
  - auth state: `auth { role, isAuthenticated, userId }`
  - notifications fields exist (`newOrderCount`), but no UI uses them.

### Data fetching strategy

- Supabase reads/writes are done via direct async calls in UI components using:
  - helper functions from `src/lib/supabase-api.ts`
- Realtime is implemented through Supabase channels and triggers full re-fetch via `loadOrders` / `loadOrder`.

### Component structure and flow

- Route components in `src/pages/*` call Supabase helper functions.
- Customer widget:
  - `MenuPage` renders `OrderTracker`
  - `CartPage` writes order IDs to localStorage using `saveOrderForTracking`
- Staff dashboards:
  - Chef: fetch orders → subscribe → update status/cancel → UI refresh from query results
  - Admin: fetch menu/categories/orders once (and re-fetch after mutations in menu tab) → compute analytics in render

## 9. Security & Validation

### Input validation techniques (frontend)

Not found: Zod or schema validation.

Validation patterns present:

- Cart and order placement:
  - `CartPage.tsx` validates only `tableId` presence before calling `placeOrder`.
- Admin menu item form:
  - `AdminMenuTab.tsx` checks `form.name`, `form.category_id`, `form.price > 0` before saving.
- Customer cancel UI:
  - `OrderConfirmation.tsx` validates client-side eligibility:
    - order status must be NEW
    - grace countdown must be > 0

### Authentication flow

Staff login:

1. `LoginPage.tsx` calls `supabase.auth.signInWithPassword({ email, password })`
2. It checks `user_roles` for the signed-in user’s `role`
3. If no role is found, it signs out immediately.

Session refresh:

- `src/App.tsx` `AuthInit` calls `checkAuth()` which:
  - `supabase.auth.getSession()`
  - fetches role from `user_roles`

### Authorization enforcement

- Frontend route protection:
  - `src/App.tsx` `ProtectedRoute` checks Zustand auth state.
- Backend enforcement:
  - Supabase RLS policies (see migrations).

### Sensitive data handling

- Secrets:
  - Supabase URL and publishable key are in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - No other secrets are found in code.
- Password handling:
  - Password is only used in staff login calls to Supabase; it is not stored in any local state beyond the input value.

### Potential security gaps (based on RLS policies + how they’re implemented)

These are derived directly from the RLS SQL conditions:

1. Customer cancellation likely not permitted by RLS
   - Frontend shows a customer cancel button in `OrderConfirmation.tsx` and calls `cancelOrder(orderId, 'customer', ...)`.
   - Supabase `orders FOR UPDATE` policy is restricted to authenticated chef/admin roles (no policy for anon or role `user` found).
   - No customer-specific UPDATE policy was found in migrations.
2. Orders INSERT policy does not validate `table_id` belongs to `restaurant_id`
   - Insert policy checks only `EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id)`.
   - There is no additional check ensuring `table_id` row’s `restaurant_id` matches `orders.restaurant_id`.
3. Order items INSERT policy does not validate `menu_item_id` belongs to the order’s restaurant
   - Insert policy checks only that `EXISTS (SELECT 1 FROM public.orders WHERE id = order_id)`.
   - There is no check of the `menu_items.restaurant_id` alignment with the order’s `restaurant_id`.
4. Global chef/admin role row can allow cross-restaurant order updates
   - The orders update policy includes `has_role(auth.uid(), 'chef'/'admin')` in addition to `has_restaurant_role`.
   - `has_role()` checks `public.user_roles` without restaurant_id filtering.

## 10. Environment & Configuration

### Environment variables

`.env` contains:

- `VITE_SUPABASE_PROJECT_ID=...`
- `VITE_SUPABASE_PUBLISHABLE_KEY=...`
- `VITE_SUPABASE_URL=...`

Used by:

- `src/integrations/supabase/client.ts` reads `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`.

### Supabase config

- `supabase/config.toml` contains:
  - `project_id`

### Not found in codebase

- No other external integrations are configured via env vars besides Supabase.
- No Stripe/Razorpay API keys are found.

## 11. Edge Cases & Conditions

### Implemented edge cases

- Dish grouping shows “No common dishes…” when there are no dish groups with `orders.length > 1`.
- Kitchen view excludes `SERVED` and `CANCELLED` orders from active display (`KitchenDashboard.tsx`).
- Customer tracking cleanup:
  - `OrderTracker.tsx` removes served/cancelled orders from `localStorage` by rewriting `customer_order_ids` after fetch.
- Order status page handles cancelled orders:
  - It hides step timeline when cancelled and shows `cancel_reason`.
- Admin analytics:
  - If no served orders in range, hourly chart returns empty and component avoids rendering it (via `hourlyData.length > 0` check).

### Potential correctness issues (grounded in code)

1. OrderStatus back-navigation may be wrong if user doesn’t reach the page via MenuPage
   - `OrderStatusPage.tsx` uses `store.tableNumber` which is set by `MenuPage` only when `table` query param exists.
   - Not found in codebase: logic that sets `tableNumber` when navigating to `/order-status/:orderId`.
2. Customer cancellation may fail
   - UI checks grace period, but backend RLS policies only allow UPDATE for authenticated chef/admin.
   - No customer update policy is found.
3. LocalStorage tracking is global, not per-table
   - `OrderTracker.tsx` uses a single key `customer_order_ids` with no table scoping.

## 12. Issues & Improvements

### Highest-priority issues (security/authorization)

1. Customer order cancellation likely blocked by RLS
   - UI feature exists (`OrderConfirmation.tsx`), but RLS `orders FOR UPDATE` appears restricted to chef/admin.
2. Integrity issues in RLS INSERT policies
   - Orders INSERT policy validates only restaurant existence, not `table_id` belonging to that restaurant.
   - Order_items INSERT policy validates only order existence, not menu item belonging to that order’s restaurant.
3. Cross-restaurant access risk via `has_role()` in orders update policy
   - `orders FOR UPDATE` includes `has_role()` which does not check restaurant_id.

### Functional improvements

1. Make `OrderStatusPage` set table number from the order payload
   - Current code relies on `store.tableNumber` (which may be stale/default).
2. Clear cart when table number changes
   - `MenuPage.tsx` does not clear Zustand `cart` when the `table` query param changes.
3. Remove dead/unused state or wire notifications properly
   - `newOrderCount` is in Zustand but not used anywhere.
4. Align PRD text with actual implementation
   - PRD claims per-table order-id storage, but code uses a global key.

## 13. How to Run the Project

From repo root (`/Users/trux/SAAS/kitchen-hub`):

1. Install:
   - `npm i`
2. Ensure `.env` is present with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - (and `VITE_SUPABASE_PROJECT_ID` is also present)
3. Start dev server:
   - `npm run dev`

Build:

- `npm run build`

