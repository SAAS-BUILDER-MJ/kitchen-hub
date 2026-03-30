import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per-instance; resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 orders per minute per table

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

interface OrderItem {
  menu_item_id: string;
  quantity: number;
  notes?: string | null;
}

interface PlaceOrderRequest {
  restaurant_id: string;
  table_id: string;
  items: OrderItem[];
  idempotency_key?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: PlaceOrderRequest = await req.json();
    const { restaurant_id, table_id, items, idempotency_key } = body;

    // ── Input validation ──────────────────────────────────────────
    if (!restaurant_id || typeof restaurant_id !== "string") {
      return new Response(JSON.stringify({ error: "Invalid restaurant_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!table_id || typeof table_id !== "string") {
      return new Response(JSON.stringify({ error: "Invalid table_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return new Response(JSON.stringify({ error: "Items must be a non-empty array (max 50)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const item of items) {
      if (!item.menu_item_id || typeof item.menu_item_id !== "string") {
        return new Response(JSON.stringify({ error: "Each item must have a valid menu_item_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return new Response(JSON.stringify({ error: `Invalid quantity for item ${item.menu_item_id}. Must be 1-99.` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (item.notes !== undefined && item.notes !== null) {
        if (typeof item.notes !== "string" || item.notes.length > 500) {
          return new Response(JSON.stringify({ error: "Notes must be a string under 500 characters" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // ── Rate limiting (per table) ──────────────────────────────────
    if (isRateLimited(table_id)) {
      return new Response(JSON.stringify({ error: "Too many orders. Please wait a moment before trying again." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Idempotency check ──────────────────────────────────────────
    if (idempotency_key && typeof idempotency_key === "string") {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, status, total_price")
        .eq("idempotency_key", idempotency_key)
        .maybeSingle();

      if (existingOrder) {
        // Return existing order (duplicate submission)
        const { data: fullOrder } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", existingOrder.id)
          .single();
        return new Response(JSON.stringify({
          order: fullOrder ? { ...fullOrder, items: fullOrder.order_items || [] } : existingOrder,
          duplicate: true,
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Verify table belongs to restaurant and is active ───────────
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id, restaurant_id, table_number, is_active")
      .eq("id", table_id)
      .eq("restaurant_id", restaurant_id)
      .single();

    if (tableError || !table) {
      return new Response(JSON.stringify({ error: "Invalid table. Please scan the QR code again." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!table.is_active) {
      return new Response(JSON.stringify({ error: "This table is currently unavailable." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate all menu items: exist, belong to restaurant, available, get real prices ─
    const menuItemIds = [...new Set(items.map((i) => i.menu_item_id))];
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id, restaurant_id, name, price, available, is_deleted")
      .in("id", menuItemIds)
      .eq("restaurant_id", restaurant_id);

    if (menuError) {
      return new Response(JSON.stringify({ error: "Failed to validate menu items" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const menuMap = new Map((menuItems || []).map((m: any) => [m.id, m]));

    // Check every requested item
    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id);
      if (!menuItem) {
        return new Response(JSON.stringify({ error: `Menu item not found or doesn't belong to this restaurant: ${item.menu_item_id}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!menuItem.available || menuItem.is_deleted) {
        return new Response(JSON.stringify({ error: `"${menuItem.name}" is currently unavailable` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Calculate total from SERVER-SIDE prices (never trust client) ─
    const orderItems = items.map((item) => {
      const menuItem = menuMap.get(item.menu_item_id)!;
      return {
        menu_item_id: item.menu_item_id,
        name: menuItem.name,           // Use DB name, not client name
        price: Number(menuItem.price), // Use DB price, not client price
        quantity: item.quantity,
        notes: item.notes?.trim() || null,
      };
    });

    const totalPrice = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // ── Create order ───────────────────────────────────────────────
    const insertData: any = {
      restaurant_id,
      table_id,
      table_number: table.table_number,
      total_price: totalPrice,
    };
    if (idempotency_key) {
      insertData.idempotency_key = idempotency_key;
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(insertData)
      .select()
      .single();

    if (orderError) {
      // Handle unique constraint on idempotency_key (race condition)
      if (orderError.code === "23505" && idempotency_key) {
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("idempotency_key", idempotency_key)
          .single();
        if (existingOrder) {
          return new Response(JSON.stringify({
            order: { ...existingOrder, items: existingOrder.order_items || [] },
            duplicate: true,
          }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Insert order items ─────────────────────────────────────────
    const orderItemRows = orderItems.map((i) => ({
      order_id: order.id,
      ...i,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemRows);

    if (itemsError) {
      // Rollback order
      await supabase.from("orders").delete().eq("id", order.id);
      return new Response(JSON.stringify({ error: "Failed to create order items" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      order: {
        ...order,
        items: orderItemRows,
      },
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
