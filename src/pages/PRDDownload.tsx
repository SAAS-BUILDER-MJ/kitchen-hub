import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { FileDown, ArrowLeft, Check } from 'lucide-react';

function cell(text: string, bold = false) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 22, font: 'Calibri' })] })],
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 100 }, children: [new TextRun({ text, bold: true, font: 'Calibri' })] });
}

function para(text: string) {
  return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, size: 22, font: 'Calibri' })] });
}

function bullet(text: string) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text, size: 22, font: 'Calibri' })] });
}

function subBullet(text: string) {
  return new Paragraph({ bullet: { level: 1 }, spacing: { after: 40 }, children: [new TextRun({ text, size: 22, font: 'Calibri' })] });
}

function boldPara(label: string, value: string) {
  return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: label, bold: true, size: 22, font: 'Calibri' }), new TextRun({ text: value, size: 22, font: 'Calibri' })] });
}

function simpleTable(headers: string[], rows: string[][]) {
  const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map(h => new TableCell({ borders, width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22, font: 'Calibri' })] })] })) }),
      ...rows.map(r => new TableRow({ children: r.map(c => new TableCell({ borders, width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: c, size: 22, font: 'Calibri' })] })] })) })),
    ],
  });
}

function generatePRD() {
  const doc = new Document({
    creator: 'QR Restaurant Platform',
    title: 'QR Restaurant SaaS Platform – Product Requirements Document',
    sections: [{
      children: [
        // Title
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'QR Restaurant SaaS Platform', bold: true, size: 40, font: 'Calibri' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Product Requirements Document (PRD)', size: 28, font: 'Calibri', color: '666666' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: `Version 1.0 — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, size: 22, font: 'Calibri', color: '999999' })] }),

        // 1. Executive Summary
        heading('1. Executive Summary'),
        para('QR Restaurant is a modern, cloud-based SaaS platform that digitizes the restaurant ordering experience. Customers scan a QR code at their table, browse a live menu, place orders, and track order status in real-time — all without needing to install an app or create an account. Staff members (chefs and admins) access dedicated dashboards for kitchen management and business analytics.'),
        para('The platform is built on React, TypeScript, and Tailwind CSS with a Lovable Cloud backend providing real-time database, authentication, and row-level security.'),

        // 2. System Architecture
        heading('2. System Architecture'),
        heading('2.1 Technology Stack', HeadingLevel.HEADING_2),
        simpleTable(['Layer', 'Technology'], [
          ['Frontend', 'React 18, TypeScript, Vite'],
          ['Styling', 'Tailwind CSS, shadcn/ui component library'],
          ['State Management', 'Zustand (client-side store)'],
          ['Backend / Database', 'Lovable Cloud (PostgreSQL, real-time subscriptions)'],
          ['Authentication', 'Lovable Cloud Auth (email/password)'],
          ['Charts', 'Recharts (revenue analytics)'],
          ['Routing', 'React Router v6'],
        ]),

        heading('2.2 Database Schema', HeadingLevel.HEADING_2),
        simpleTable(['Table', 'Purpose', 'Key Columns'], [
          ['restaurants', 'Restaurant profiles', 'id, name, description, logo_url, address, phone'],
          ['tables', 'Physical tables per restaurant', 'id, restaurant_id, table_number, is_active, qr_code'],
          ['menu_categories', 'Menu sections (Starters, Mains…)', 'id, restaurant_id, name, sort_order'],
          ['menu_items', 'Individual dishes', 'id, category_id, restaurant_id, name, price, emoji, available'],
          ['orders', 'Customer orders', 'id, restaurant_id, table_id, table_number, status, total_price'],
          ['order_items', 'Line items per order', 'id, order_id, menu_item_id, name, quantity, price'],
          ['user_roles', 'Staff role assignments', 'id, user_id, role (admin/chef/user), restaurant_id'],
        ]),

        heading('2.3 Security Model', HeadingLevel.HEADING_2),
        para('Row-Level Security (RLS) is enabled on every table:'),
        bullet('Menu items & categories: publicly readable; admin-only write access'),
        bullet('Orders: publicly insertable and readable; update restricted to authenticated chef/admin roles'),
        bullet('Order items: publicly insertable (with order existence check) and readable'),
        bullet('User roles: users can read their own roles; admins can manage all roles'),
        bullet('Role checks use SECURITY DEFINER functions (has_role, has_restaurant_role) to prevent recursive RLS'),

        // 3. User Roles & Access Control
        heading('3. User Roles & Access Control'),
        simpleTable(['Role', 'Access', 'Authentication'], [
          ['Customer', 'Menu browsing, cart, order placement, order tracking', 'None required (public)'],
          ['Chef', 'Kitchen Dashboard only', 'Email/password login'],
          ['Admin', 'Admin Dashboard (overview, orders, menu management)', 'Email/password login'],
        ]),
        para('Route protection rules:'),
        bullet('/kitchen — requires authenticated user with "chef" role; otherwise redirects to /login'),
        bullet('/admin — requires authenticated user with "admin" role; otherwise redirects to /login'),
        bullet('/dashboard — smart router: chefs → Kitchen Dashboard, admins → Admin Dashboard'),
        bullet('Cross-role access attempts redirect to /login (not to another dashboard)'),

        // 4. Customer Experience
        heading('4. Customer Experience'),

        heading('4.1 QR Code Entry & Table Assignment', HeadingLevel.HEADING_2),
        bullet('Customer scans a QR code at their table'),
        bullet('QR encodes URL: /menu?table={tableNumber}'),
        bullet('System fetches table ID from database and stores in Zustand + sets table number'),
        bullet('If table not found, system shows error with retry'),

        heading('4.2 Menu Browsing', HeadingLevel.HEADING_2),
        bullet('Menu items fetched from database, grouped by category'),
        bullet('Each item shows: emoji, name, description, price (₹)'),
        bullet('Unavailable items are visually disabled'),
        bullet('Search functionality to filter items by name'),
        bullet('"Add to Cart" button with quantity controls'),

        heading('4.3 Shopping Cart', HeadingLevel.HEADING_2),
        bullet('Persistent client-side cart (Zustand store)'),
        bullet('Increment/decrement quantity or remove items'),
        bullet('Real-time total calculation'),
        bullet('Table number displayed for confirmation'),
        bullet('"Place Order" submits to database and clears cart'),

        heading('4.4 Order Confirmation', HeadingLevel.HEADING_2),
        bullet('After order placement, redirect to /order-confirmation/{orderId}'),
        bullet('Shows order summary with item details and total'),
        bullet('Provides link to track order status'),

        heading('4.5 Customer Order Tracking', HeadingLevel.HEADING_2),
        para('A floating "My Orders" button appears on the menu page when the customer has active orders.'),
        bullet('Order IDs stored in localStorage per table (key: qr_orders_{tableNumber})'),
        bullet('Real-time status updates via Supabase realtime subscriptions'),
        bullet('Visual progress tracker showing: NEW → PREPARING → READY → SERVED'),
        bullet('Each status has a distinct icon and color for quick recognition'),
        bullet('SERVED orders are automatically removed from tracking view'),
        para('Edge Cases Handled:'),
        subBullet('Table reuse: When a new customer sits at the same table, served orders are already cleared from localStorage'),
        subBullet('Multiple orders: Customer can place multiple orders from the same table; all active orders appear in tracker'),
        subBullet('Browser refresh: Orders persist via localStorage and re-fetch status from database'),

        // 5. Kitchen Dashboard
        heading('5. Kitchen Dashboard'),
        para('Accessible at /kitchen by authenticated users with the "chef" role.'),

        heading('5.1 Active Orders View', HeadingLevel.HEADING_2),
        bullet('Displays only active orders: NEW, PREPARING, READY (SERVED orders are excluded)'),
        bullet('Sorted chronologically — oldest orders first (FIFO for kitchen efficiency)'),
        bullet('Each order card shows: table number, order time, items with quantities, current status'),
        bullet('Color-coded status badges: NEW (amber), PREPARING (blue), READY (green)'),

        heading('5.2 Status Management', HeadingLevel.HEADING_2),
        bullet('Chef can advance order through statuses: NEW → PREPARING → READY → SERVED'),
        bullet('Status updates are persisted to database via Supabase'),
        bullet('Real-time sync: changes reflect immediately on customer tracking and admin dashboard'),
        bullet('Once marked SERVED, order disappears from kitchen view'),

        heading('5.3 Dish Grouping (Batch Cooking)', HeadingLevel.HEADING_2),
        para('A toggleable "Dish Groups" section aggregates common items across all active orders:'),
        bullet('Groups items by menu_item_id across orders'),
        bullet('Shows total quantity needed and which table numbers ordered each dish'),
        bullet('Helps chefs prepare larger batches instead of cooking the same dish repeatedly'),
        bullet('Example: "Cappuccino — 7 total (Tables 1, 3, 5)"'),

        heading('5.4 Real-time Updates', HeadingLevel.HEADING_2),
        bullet('Subscribes to orders table changes via Supabase Realtime'),
        bullet('New orders appear automatically without page refresh'),
        bullet('Sound/visual notification for new orders (newOrderCount in store)'),

        // 6. Admin Dashboard
        heading('6. Admin Dashboard'),
        para('Accessible at /admin by authenticated users with the "admin" role.'),

        heading('6.1 Date Filtering', HeadingLevel.HEADING_2),
        para('A date filter at the top controls data across all tabs:'),
        bullet('Presets: Today, Yesterday, This Week, This Month'),
        bullet('Custom date range picker for arbitrary periods'),
        bullet('All metrics, charts, and order lists update based on selected date range'),

        heading('6.2 Overview Tab', HeadingLevel.HEADING_2),
        para('Key performance metrics (calculated from SERVED orders only):'),
        simpleTable(['Metric', 'Description', 'Calculation'], [
          ['Total Revenue', 'Income from served orders', 'Sum of total_price where status = SERVED'],
          ['Total Orders', 'All orders in date range', 'Count of all orders'],
          ['Tables Served', 'Unique tables with orders', 'Count of distinct table_numbers'],
          ['Avg. Order Value', 'Revenue per served order', 'Total Revenue ÷ Served Order Count'],
        ]),
        para('Revenue Rule: Only orders with status "SERVED" contribute to revenue calculations. This accounts for potential order cancellations — an order that is NEW, PREPARING, or READY has not generated confirmed revenue.'),

        heading('6.2.1 Order Status Breakdown', HeadingLevel.HEADING_3),
        bullet('Visual breakdown showing count of orders in each status (NEW, PREPARING, READY, SERVED)'),
        bullet('Filtered by selected date range'),

        heading('6.2.2 Popular Items', HeadingLevel.HEADING_3),
        bullet('Top menu items ranked by total quantity ordered'),
        bullet('Filtered by selected date range'),
        bullet('Shows item name, emoji, and order count'),

        heading('6.2.3 Hourly Revenue Chart', HeadingLevel.HEADING_3),
        bullet('Bar chart showing revenue by hour of day'),
        bullet('Only includes SERVED orders'),
        bullet('Helps identify peak business hours'),
        bullet('Powered by Recharts library'),

        heading('6.3 Orders Tab', HeadingLevel.HEADING_2),
        bullet('Full list of orders within selected date range'),
        bullet('Search: filter by table number or item name'),
        bullet('Status filter: All / NEW / PREPARING / READY / SERVED'),
        bullet('Sort toggle: Oldest First (default) or Newest First'),
        bullet('Each order card shows: table number, status badge, items with prices, total, timestamp'),
        bullet('CSV Export: download filtered orders as CSV for accounting'),

        heading('6.4 Menu Management Tab', HeadingLevel.HEADING_2),
        bullet('View all menu items with category, price, and availability'),
        bullet('Toggle item availability (available/unavailable)'),
        bullet('Add new menu items with: name, description, price, emoji, category'),
        bullet('Edit existing items'),
        bullet('Delete menu items'),

        // 7. Data Flow
        heading('7. Data Flow'),
        heading('7.1 Order Lifecycle', HeadingLevel.HEADING_2),
        para('1. Customer adds items to cart → 2. Places order (inserts into orders + order_items tables) → 3. Order appears on Kitchen Dashboard with status NEW → 4. Chef updates to PREPARING → 5. Chef updates to READY → 6. Chef updates to SERVED → 7. Order removed from kitchen view and customer tracker → 8. Revenue counted in admin analytics.'),

        heading('7.2 Real-time Subscriptions', HeadingLevel.HEADING_2),
        simpleTable(['Channel', 'Table', 'Events', 'Consumer'], [
          ['orders-realtime', 'orders', 'INSERT, UPDATE, DELETE', 'Kitchen Dashboard, Admin Dashboard'],
          ['order-{orderId}', 'orders', 'UPDATE', 'Customer Order Tracking (per order)'],
        ]),

        // 8. API Layer
        heading('8. API Layer (supabase-api.ts)'),
        simpleTable(['Function', 'Description'], [
          ['fetchMenuItems(restaurantId)', 'Get all menu items with category names'],
          ['fetchCategories(restaurantId)', 'Get menu categories sorted by sort_order'],
          ['createMenuItem(item)', 'Add new menu item'],
          ['updateMenuItem(id, updates)', 'Update menu item fields'],
          ['deleteMenuItem(id)', 'Remove menu item'],
          ['fetchTable(restaurantId, tableNumber)', 'Get table by restaurant and number'],
          ['placeOrder(restaurantId, tableId, tableNumber, items)', 'Create order + order items'],
          ['fetchOrders(restaurantId)', 'Get all orders with items'],
          ['fetchOrder(orderId)', 'Get single order with items'],
          ['updateOrderStatus(orderId, status)', 'Change order status'],
          ['subscribeToOrders(restaurantId, callback)', 'Real-time order subscription'],
          ['subscribeToOrder(orderId, callback)', 'Real-time single order subscription'],
        ]),

        // 9. State Management
        heading('9. State Management (Zustand Store)'),
        simpleTable(['State Slice', 'Purpose'], [
          ['cart[]', 'Client-side shopping cart items'],
          ['tableNumber / tableId', 'Current table identification'],
          ['restaurantId', 'Demo restaurant ID'],
          ['auth { role, isAuthenticated, userId }', 'Authentication state'],
          ['newOrderCount', 'Notification counter for new orders'],
        ]),
        para('Key actions: addToCart, removeFromCart, updateQuantity, clearCart, login, logout, checkAuth'),

        // 10. Route Map
        heading('10. Route Map'),
        simpleTable(['Path', 'Component', 'Access', 'Description'], [
          ['/', 'Index', 'Public', 'Landing page with table quick links'],
          ['/menu?table={n}', 'MenuPage', 'Public', 'Menu browsing + order tracking'],
          ['/cart', 'CartPage', 'Public', 'Shopping cart + order placement'],
          ['/order-confirmation/:id', 'OrderConfirmation', 'Public', 'Post-order summary'],
          ['/order-status/:id', 'OrderStatusPage', 'Public', 'Real-time order status page'],
          ['/login', 'LoginPage', 'Public', 'Staff authentication'],
          ['/kitchen', 'KitchenDashboard', 'Chef only', 'Kitchen order management'],
          ['/admin', 'AdminDashboard', 'Admin only', 'Business analytics + menu mgmt'],
          ['/dashboard', 'StaffRouter', 'Authenticated', 'Auto-routes to role dashboard'],
        ]),

        // 11. Edge Cases & Business Rules
        heading('11. Edge Cases & Business Rules'),
        bullet('Revenue only counts SERVED orders — cancellations before serving do not affect revenue'),
        bullet('Kitchen shows only active orders (NEW/PREPARING/READY) — SERVED orders auto-removed'),
        bullet('Table reuse: served orders cleared from customer localStorage tracker'),
        bullet('Supabase default query limit is 1000 rows — pagination needed for high-volume restaurants'),
        bullet('Chef accessing /admin → redirected to /login (not to kitchen)'),
        bullet('Admin accessing /kitchen → redirected to /login'),
        bullet('Unauthenticated users accessing staff routes → redirected to /login'),
        bullet('Menu items marked unavailable are shown but disabled for ordering'),
        bullet('Order items reference menu_item_id for analytics but store name/price as snapshot (price changes don\'t affect historical orders)'),

        // 12. Future Roadmap
        heading('12. Future Roadmap'),
        bullet('Order cancellation by staff with reason tracking'),
        bullet('Multi-restaurant support with restaurant switcher'),
        bullet('Payment integration (Razorpay/Stripe)'),
        bullet('Push notifications for order ready'),
        bullet('Table management UI (add/remove/deactivate tables)'),
        bullet('Waiter role with table assignment'),
        bullet('Customer feedback/rating after meal'),
        bullet('Inventory management linked to menu items'),
        bullet('Multi-language menu support'),
        bullet('QR code generator for table setup'),

        // Footer
        new Paragraph({ spacing: { before: 600 }, children: [] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '— End of Document —', italics: true, size: 20, font: 'Calibri', color: '999999' })] }),
      ],
    }],
  });

  return doc;
}

const PRDDownload = () => {
  const navigate = useNavigate();
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    const doc = generatePRD();
    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'QR_Restaurant_PRD.docx');
    setDownloaded(true);
  };

  useEffect(() => {
    // Auto-download on mount
    handleDownload();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <span className="text-6xl block">📄</span>
        <h1 className="text-2xl font-bold">Product Requirements Document</h1>
        <p className="text-muted-foreground">
          QR Restaurant SaaS Platform — Complete PRD
        </p>

        {downloaded ? (
          <div className="flex items-center justify-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">Download started!</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button onClick={handleDownload} className="w-full py-5">
            <FileDown className="h-5 w-5 mr-2" />
            Download PRD (.docx)
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PRDDownload;
